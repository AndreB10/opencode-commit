export type ModelRef = {
  providerID: string;
  modelID: string;
};

export type PluginOptions = {
  agent?: string;
  maxDiffChars?: number;
};

export type ResolvedPluginConfig = {
  agent: string;
  maxDiffChars: number;
};

export const DEFAULT_AGENT = "commit-writer";
export const DEFAULT_MAX_DIFF_CHARS = 12_000;

export function resolveConfig(options?: PluginOptions): ResolvedPluginConfig {
  return {
    agent: options?.agent?.trim() || DEFAULT_AGENT,
    maxDiffChars:
      typeof options?.maxDiffChars === "number" && options.maxDiffChars > 0
        ? Math.floor(options.maxDiffChars)
        : DEFAULT_MAX_DIFF_CHARS,
  };
}

export type GitContext = {
  branch: string;
  stat: string;
  diff: string;
  recentCommits: string[];
  hasStagedChanges: boolean;
};

export type AgentInfo = {
  name: string;
  model?: ModelRef;
};
