import type { Plugin } from "@opencode-ai/plugin";
import type { Part } from "@opencode-ai/sdk";
import { gatherGitContext, isGitRepo } from "./git.js";
import { generateCommitMessage } from "./generate.js";
import {
  buildCommitGroups,
  parseCommitRequest,
  parseModelRef,
  resolveConfig,
  type CommitGroup,
  type CommitRequest,
  type PluginOptions,
} from "./types.js";

const COMMAND_NAME = "commit";
const COMMAND_DESCRIPTION =
  "Generate a commit message or split commit plan from uncommitted changes";
const COMMAND_TEMPLATE = "Handled by the opencode-commit plugin.";

function textPart(text: string): Part {
  return { type: "text", text } as Part;
}

function formatOutput(input: {
  content: string;
  modelLabel: string;
  childSessionID: string;
  request: CommitRequest;
  missingFolders?: string[];
}): string {
  if (input.request.mode === "split") {
    const missingFolders = input.missingFolders ?? [];
    const missingBlock =
      missingFolders.length > 0
        ? [
            `No changes found for requested folder(s): ${formatFolderList(missingFolders)}.`,
            "",
          ]
        : [];

    return [
      "## Suggested commit plan",
      "",
      ...missingBlock,
      input.content,
      "",
      `Model: \`${input.modelLabel}\` · Child session: \`${input.childSessionID}\``,
      "",
      "Stage the listed files for each commit, then run `git commit` with the suggested message.",
    ].join("\n");
  }

  return [
    "## Suggested commit message",
    "",
    "```",
    input.content,
    "```",
    "",
    `Model: \`${input.modelLabel}\` · Child session: \`${input.childSessionID}\``,
    "",
    "Copy the message above and run `git commit` when ready.",
  ].join("\n");
}

function formatFolderList(folders: string[]): string {
  return folders.map((folder) => `\`${folder}\``).join(", ");
}

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
      cfg.command[COMMAND_NAME] = {
        description: COMMAND_DESCRIPTION,
        template: COMMAND_TEMPLATE,
      };

      if (config.model) {
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
          return;
        }

        const model = parseModelRef(config.model);
        const request = parseCommitRequest(input.arguments);

        if (!(await isGitRepo($, worktree))) {
          output.parts = [
            textPart(
              "Not a git repository. Run `/commit` from inside a git worktree.",
            ),
          ];
          return;
        }

        const context = await gatherGitContext($, worktree, config.maxDiffChars);

        if (!context.hasUncommittedChanges) {
          output.parts = [
            textPart(
              "No uncommitted changes found. Make changes and run `/commit` again.",
            ),
          ];
          return;
        }

        let groups: CommitGroup[] | undefined;
        let missingFolders: string[] = [];
        if (request.mode === "split") {
          const grouped = buildCommitGroups(context.changedFiles, request.folders);
          groups = grouped.groups;
          missingFolders = grouped.missingFolders;

          if (groups.length === 0) {
            const target =
              request.folders.length > 0
                ? `requested folder(s): ${formatFolderList(request.folders)}`
                : "changed folders";
            output.parts = [textPart(`No changes found for ${target}.`)];
            return;
          }
        }

        await log("info", "Generating commit message", {
          model: config.model,
          mode: request.mode,
          folders: request.mode === "split" ? request.folders : undefined,
          branch: context.branch,
          sessionID: input.sessionID,
        });

        const result = await generateCommitMessage({
          client,
          parentSessionID: input.sessionID,
          model,
          context,
          request,
          groups,
        });

        output.parts = [
          textPart(formatOutput({ ...result, request, missingFolders })),
        ];
        return;
      } catch (error) {
        await log("error", "Commit message generation failed", {
          error: String(error),
          sessionID: input.sessionID,
        });

        output.parts = [
          textPart(`Failed to generate commit message: ${String(error)}`),
        ];
        return;
      }
    },
  };
};

export default OpenCodeCommitPlugin;
