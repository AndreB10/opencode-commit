import type { PluginInput } from "@opencode-ai/plugin";
import type { GitContext } from "./types.js";

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

  const stat = await readGitOutput($, worktree, ($) =>
    $`git diff --staged --stat`.cwd(worktree).quiet().nothrow(),
  );
  const rawDiff = await readGitOutput($, worktree, ($) =>
    $`git diff --staged`.cwd(worktree).quiet().nothrow(),
  );
  const diff =
    rawDiff.length > maxDiffChars
      ? `${rawDiff.slice(0, maxDiffChars)}\n\n[diff truncated at ${maxDiffChars} characters]`
      : rawDiff;

  const logOutput = await readGitOutput($, worktree, ($) =>
    $`git log -5 --pretty=format:%s`.cwd(worktree).quiet().nothrow(),
  );
  const recentCommits = logOutput
    ? logOutput.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];

  const hasStagedChanges = stat.length > 0 || rawDiff.length > 0;

  return {
    branch,
    stat,
    diff,
    recentCommits,
    hasStagedChanges,
  };
}
