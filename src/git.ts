import type { PluginInput } from "@opencode-ai/plugin";
import type { ChangedFile, ChangedFileSource, GitContext } from "./types.js";

type Shell = PluginInput["$"];

async function readGitOutput(
  $: Shell,
  worktree: string,
  run: ($: Shell) => Promise<{ exitCode: number; stdout?: { toString(): string } }>,
): Promise<string> {
  const result = await run($);
  if (result.exitCode !== 0) {
    return "";
  }
  return result.stdout?.toString().trim() ?? "";
}

export async function isGitRepo($: Shell, worktree: string): Promise<boolean> {
  const result = await $`git rev-parse --git-dir`.cwd(worktree).quiet().nothrow();
  return result.exitCode === 0;
}

function truncateDiff(diff: string, maxChars: number, label: string): string {
  if (diff.length <= maxChars) return diff;
  return `${diff.slice(0, maxChars)}\n\n[${label} diff truncated at ${maxChars} characters]`;
}

function splitDiffs(input: {
  staged: string;
  unstaged: string;
  maxDiffChars: number;
}): { staged: string; unstaged: string } {
  if (!input.staged || !input.unstaged) {
    return {
      staged: truncateDiff(input.staged, input.maxDiffChars, "staged"),
      unstaged: truncateDiff(input.unstaged, input.maxDiffChars, "unstaged"),
    };
  }

  const half = Math.floor(input.maxDiffChars / 2);
  let stagedLimit = Math.min(input.staged.length, half);
  let unstagedLimit = Math.min(
    input.unstaged.length,
    input.maxDiffChars - stagedLimit,
  );
  stagedLimit = Math.min(input.staged.length, input.maxDiffChars - unstagedLimit);

  return {
    staged: truncateDiff(input.staged, stagedLimit, "staged"),
    unstaged: truncateDiff(input.unstaged, unstagedLimit, "unstaged"),
  };
}

function parseNameStatus(
  output: string,
  source: ChangedFileSource,
): ChangedFile[] {
  if (!output) return [];

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t");
      return {
        path: paths[paths.length - 1] ?? "",
        status: status ?? "?",
        source,
      };
    })
    .filter((file) => file.path.length > 0);
}

export async function gatherGitContext(
  $: Shell,
  worktree: string,
  maxDiffChars: number,
): Promise<GitContext> {
  const branch =
    (await readGitOutput($, worktree, ($) =>
      $`git symbolic-ref --quiet --short HEAD`.cwd(worktree).quiet().nothrow(),
    )) ||
    (await readGitOutput($, worktree, ($) =>
      $`git rev-parse --short HEAD`.cwd(worktree).quiet().nothrow(),
    )) ||
    "unknown";

  const stagedStat = await readGitOutput($, worktree, ($) =>
    $`git diff --staged --stat`.cwd(worktree).quiet().nothrow(),
  );
  const rawStagedDiff = await readGitOutput($, worktree, ($) =>
    $`git diff --staged`.cwd(worktree).quiet().nothrow(),
  );
  const stagedNameStatus = await readGitOutput($, worktree, ($) =>
    $`git diff --staged --name-status`.cwd(worktree).quiet().nothrow(),
  );
  const unstagedStat = await readGitOutput($, worktree, ($) =>
    $`git diff --stat`.cwd(worktree).quiet().nothrow(),
  );
  const rawUnstagedDiff = await readGitOutput($, worktree, ($) =>
    $`git diff`.cwd(worktree).quiet().nothrow(),
  );
  const unstagedNameStatus = await readGitOutput($, worktree, ($) =>
    $`git diff --name-status`.cwd(worktree).quiet().nothrow(),
  );
  const untrackedOutput = await readGitOutput($, worktree, ($) =>
    $`git ls-files --others --exclude-standard`.cwd(worktree).quiet().nothrow(),
  );
  const untrackedFiles = untrackedOutput
    ? untrackedOutput.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];
  const diffs = splitDiffs({
    staged: rawStagedDiff,
    unstaged: rawUnstagedDiff,
    maxDiffChars,
  });
  const changedFiles = [
    ...parseNameStatus(stagedNameStatus, "staged"),
    ...parseNameStatus(unstagedNameStatus, "unstaged"),
    ...untrackedFiles.map((path) => ({
      path,
      status: "A",
      source: "untracked" as const,
    })),
  ];

  const logOutput = await readGitOutput($, worktree, ($) =>
    $`git log -5 --pretty=format:%s`.cwd(worktree).quiet().nothrow(),
  );
  const recentCommits = logOutput
    ? logOutput.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];

  const hasUncommittedChanges =
    stagedStat.length > 0 ||
    rawStagedDiff.length > 0 ||
    unstagedStat.length > 0 ||
    rawUnstagedDiff.length > 0 ||
    untrackedFiles.length > 0;

  return {
    branch,
    stagedStat,
    stagedDiff: diffs.staged,
    unstagedStat,
    unstagedDiff: diffs.unstaged,
    changedFiles,
    untrackedFiles,
    recentCommits,
    hasUncommittedChanges,
  };
}
