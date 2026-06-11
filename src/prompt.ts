import type { GitContext } from "./types.js";

export const COMMIT_SYSTEM_PROMPT = [
  "You are a commit message writer.",
  "Given git changes and context, produce a single commit message.",
  "Output only the commit message text.",
].join("\n");

export function buildCommitPrompt(context: GitContext, userHint?: string): string {
  const recentCommitsBlock =
    context.recentCommits.length > 0
      ? context.recentCommits.map((subject) => `- ${subject}`).join("\n")
      : "(none)";
  const untrackedFilesBlock =
    context.untrackedFiles.length > 0
      ? context.untrackedFiles.map((file) => `- ${file}`).join("\n")
      : "(none)";

  const hintBlock =
    userHint && userHint.trim().length > 0
      ? `\nAdditional instruction from the user:\n${userHint.trim()}\n`
      : "";

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
Branch: ${context.branch}

Recent commit subjects (align scope naming when sensible):
${recentCommitsBlock}

Staged tracked changes (stat):
${context.stagedStat || "(empty)"}

Staged tracked diff:
${context.stagedDiff || "(empty)"}

Unstaged tracked changes (stat):
${context.unstagedStat || "(empty)"}

Unstaged tracked diff:
${context.unstagedDiff || "(empty)"}

Untracked files (filenames only, contents not read):
${untrackedFilesBlock}
`;
}

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:\w*\n)?([\s\S]*?)```$/);
  return (fenced?.[1] ?? trimmed).trim();
}
