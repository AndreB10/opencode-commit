import type {
  ChangedFile,
  CommitGroup,
  CommitRequest,
  GitContext,
} from "./types.js";

export const COMMIT_SYSTEM_PROMPT = [
  "You are a commit message writer.",
  "Given git changes and context, produce the requested commit output.",
  "Output only the requested commit message or commit plan.",
].join("\n");

function formatChangedFiles(files: ChangedFile[]): string {
  if (files.length === 0) return "(none)";

  const filesByPath = new Map<string, string[]>();
  for (const file of files) {
    filesByPath.set(file.path, [
      ...(filesByPath.get(file.path) ?? []),
      `${file.source}:${file.status}`,
    ]);
  }

  return Array.from(filesByPath, ([path, details]) =>
    `- ${path} (${details.join(", ")})`,
  ).join("\n");
}

function formatCommitGroups(groups: CommitGroup[]): string {
  if (groups.length === 0) return "(none)";

  return groups
    .map((group) => `### ${group.name}\n${formatChangedFiles(group.files)}`)
    .join("\n\n");
}

export function buildCommitPrompt(input: {
  context: GitContext;
  request: CommitRequest;
  groups?: CommitGroup[];
}): string {
  const { context, request } = input;
  const recentCommitsBlock =
    context.recentCommits.length > 0
      ? context.recentCommits.map((subject) => `- ${subject}`).join("\n")
      : "(none)";
  const untrackedFilesBlock =
    context.untrackedFiles.length > 0
      ? context.untrackedFiles.map((file) => `- ${file}`).join("\n")
      : "(none)";
  const changedFilesBlock = formatChangedFiles(context.changedFiles);

  const hintBlock =
    request.mode === "single" && request.userHint
      ? `\nAdditional instruction from the user:\n${request.userHint}\n`
      : "";

  const contextBlock = `Branch: ${context.branch}

Recent commit subjects (align scope naming when sensible):
${recentCommitsBlock}

Changed files:
${changedFilesBlock}

Staged tracked changes (stat):
${context.stagedStat || "(empty)"}

Staged tracked diff:
${context.stagedDiff || "(empty)"}

Unstaged tracked changes (stat):
${context.unstagedStat || "(empty)"}

Unstaged tracked diff:
${context.unstagedDiff || "(empty)"}

Untracked files (filenames only, contents not read):
${untrackedFilesBlock}`;

  if (request.mode === "split") {
    return `Write a split commit plan for the uncommitted changes below.

Format rules (Conventional Commits - required):
- Produce one commit plan item for each split group listed below
- Do NOT include groups that are not listed below
- Each message subject MUST use type(scope): description or type: description
- Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Scope is optional but preferred when changes are localized (e.g. feat(auth):, fix(api):)
- Description: imperative mood, lowercase, no trailing period, max 72 chars for the full subject
- Optional body: blank line after subject, then bullet points; keep lines <= 72 chars
- Breaking changes: use feat!: or fix!: prefix, or add a BREAKING CHANGE: footer
- Use staged and unstaged tracked diffs as the source of truth
- Untracked files are filenames only; do not infer contents that are not shown
- Output ONLY the commit plan markdown - no top-level title, no commentary, no tool calls

Output format for each group:
### group-name
Files:
- path/to/file

Message:
fenced text block containing only that group's commit message

Split groups:
${formatCommitGroups(input.groups ?? [])}

${contextBlock}
`;
  }

  return `Write a git commit message for the uncommitted changes below.

Format rules (Conventional Commits - required):
- Subject line MUST use type(scope): description or type: description
- Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Scope is optional but preferred when changes are localized (e.g. feat(auth):, fix(api):)
- Description: imperative mood, lowercase, no trailing period, max 72 chars for the full subject
- Optional body: blank line after subject, then bullet points; keep lines <= 72 chars
- Breaking changes: use feat!: or fix!: prefix, or add a BREAKING CHANGE: footer
- Do NOT use free-form subjects like "Update files", "WIP", or "Misc changes"
- Use staged and unstaged tracked diffs as the source of truth
- Untracked files are filenames only; do not infer contents that are not shown
- Output ONLY the commit message text - no code fences, no commentary, no tool calls

Examples:
feat(auth): add oauth login flow

- add google and github providers
- store refresh tokens in secure storage

fix(api): handle null response from user endpoint
${hintBlock}
${contextBlock}
`;
}

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:\w*\n)?([\s\S]*?)```$/);
  return (fenced?.[1] ?? trimmed).trim();
}
