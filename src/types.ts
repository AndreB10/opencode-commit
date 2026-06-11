export type ModelRef = {
  providerID: string;
  modelID: string;
};

export type PluginOptions = {
  model?: string;
  maxDiffChars?: number;
};

export type ResolvedPluginConfig = {
  model?: string;
  maxDiffChars: number;
};

export const DEFAULT_MAX_DIFF_CHARS = 12_000;

export function resolveConfig(options?: PluginOptions): ResolvedPluginConfig {
  const model = typeof options?.model === "string" ? options.model.trim() : "";

  return {
    model: model || undefined,
    maxDiffChars:
      typeof options?.maxDiffChars === "number" && options.maxDiffChars > 0
        ? Math.floor(options.maxDiffChars)
        : DEFAULT_MAX_DIFF_CHARS,
  };
}

export function parseModelRef(model: string): ModelRef {
  const separator = model.indexOf("/");
  if (separator <= 0 || separator === model.length - 1) {
    throw new Error(
      `Invalid commit model \`${model}\`. Use the format \`provider/model-id\`.`,
    );
  }

  return {
    providerID: model.slice(0, separator),
    modelID: model.slice(separator + 1),
  };
}

export type GitContext = {
  branch: string;
  stagedStat: string;
  stagedDiff: string;
  unstagedStat: string;
  unstagedDiff: string;
  untrackedFiles: string[];
  recentCommits: string[];
  hasUncommittedChanges: boolean;
};
