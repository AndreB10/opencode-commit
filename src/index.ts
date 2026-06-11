import type { Plugin } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { gatherGitContext, isGitRepo } from "./git.js";
import { generateCommitMessage } from "./generate.js";
import { parseModelRef, resolveConfig, type PluginOptions } from "./types.js";

const COMMAND_NAME = "commit";
const COMMAND_DESCRIPTION = "Generate a commit message from uncommitted changes";
const COMMAND_TEMPLATE = "Handled by the opencode-commit plugin.";
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
    config: async (cfg) => {
      cfg.command ??= {};
      cfg.command[COMMAND_NAME] ??= {
        description: COMMAND_DESCRIPTION,
        template: COMMAND_TEMPLATE,
      };

      if (config.model && !cfg.command[COMMAND_NAME].model) {
        cfg.command[COMMAND_NAME].model = config.model;
      }
    },
    "command.execute.before": async (input, output) => {
      if (input.command !== COMMAND_NAME) return;

      try {
        if (!config.model) {
          output.parts = [
            textPart(
              [
                "No commit model configured.",
                "",
                "Add a `model` option to the opencode-commit plugin config, for example:",
                "`[\"@andre-barbosa/opencode-commit\", { \"model\": \"opencode-go/deepseek-v4-flash\" }]`",
              ].join("\n"),
            ),
          ];
          return skipCommand();
        }

        const model = parseModelRef(config.model);

        if (!(await isGitRepo($, worktree))) {
          output.parts = [
            textPart(
              "Not a git repository. Run `/commit` from inside a git worktree.",
            ),
          ];
          return skipCommand();
        }

        const context = await gatherGitContext($, worktree, config.maxDiffChars);

        if (!context.hasUncommittedChanges) {
          output.parts = [
            textPart(
              "No uncommitted changes found. Make changes and run `/commit` again.",
            ),
          ];
          return skipCommand();
        }

        await log("info", "Generating commit message", {
          model: config.model,
          branch: context.branch,
          sessionID: input.sessionID,
        });

        const userHint = input.arguments?.trim() || undefined;
        const result = await generateCommitMessage({
          client,
          parentSessionID: input.sessionID,
          model,
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
