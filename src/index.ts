import type { Plugin } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { gatherGitContext, isGitRepo } from "./git.js";
import { fetchAgent, generateCommitMessage } from "./generate.js";
import { resolveConfig, type PluginOptions } from "./types.js";

const COMMAND_NAME = "commit";
const SKIP_ERROR = "skip";

function textPart(text: string): Part {
  return { type: "text", text } as Part;
}

function formatOutput(input: {
  message: string;
  modelLabel: string;
  childSessionID: string;
}): string {
  return [
    "## Suggested commit message",
    "",
    "```",
    input.message,
    "```",
    "",
    `Model: \`${input.modelLabel}\` · Child session: \`${input.childSessionID}\``,
    "",
    "Copy the message above and run `git commit` when ready.",
  ].join("\n");
}

const skipCommand = (): never => {
  throw new Error(SKIP_ERROR);
};

export const OpenCodeCommitPlugin: Plugin = async (
  { client, $, worktree },
  options?: PluginOptions,
) => {
  const config = resolveConfig(options);

  const log = async (
    level: "info" | "warn" | "error",
    message: string,
    extra?: Record<string, unknown>,
  ) => {
    await client.app
      .log({
        body: {
          service: "opencode-commit",
          level,
          message,
          extra,
        },
      })
      .catch(() => {});
  };

  return {
    "command.execute.before": async (input, output) => {
      if (input.command !== COMMAND_NAME) return;

      try {
        if (!(await isGitRepo($, worktree))) {
          output.parts = [
            textPart(
              "Not a git repository. Run `/commit` from inside a git worktree.",
            ),
          ];
          return skipCommand();
        }

        const context = await gatherGitContext($, worktree, config.maxDiffChars);

        if (!context.hasStagedChanges) {
          output.parts = [
            textPart(
              "No staged changes found. Stage files with `git add` and run `/commit` again.",
            ),
          ];
          return skipCommand();
        }

        const resolvedAgent = await fetchAgent(client, config.agent);
        if (!resolvedAgent) {
          output.parts = [
            textPart(
              [
                `Sub-agent \`${config.agent}\` is not configured.`,
                "",
                "Copy `agents/commit-writer.md` from this plugin into `.opencode/agents/commit-writer.md`,",
                "or add the agent to your `opencode.json`.",
              ].join("\n"),
            ),
          ];
          return skipCommand();
        }

        await log("info", "Generating commit message", {
          agent: config.agent,
          branch: context.branch,
          sessionID: input.sessionID,
        });

        const userHint = input.arguments?.trim() || undefined;
        const result = await generateCommitMessage({
          client,
          parentSessionID: input.sessionID,
          agentName: config.agent,
          agent: resolvedAgent,
          context,
          userHint,
        });

        output.parts = [textPart(formatOutput(result))];
        return skipCommand();
      } catch (error) {
        if (error instanceof Error && error.message === SKIP_ERROR) {
          throw error;
        }

        await log("error", "Commit message generation failed", {
          error: String(error),
          sessionID: input.sessionID,
        });

        output.parts = [
          textPart(`Failed to generate commit message: ${String(error)}`),
        ];
        return skipCommand();
      }
    },
  };
};

export default OpenCodeCommitPlugin;
