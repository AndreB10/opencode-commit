export type ModelRef = {
  providerID: string;
  modelID: string;
};

export type CommitRequest =
  | {
      mode: "single";
      userHint?: string;
    }
  | {
      mode: "split";
      folders: string[];
    };

export type ChangedFileSource = "staged" | "unstaged" | "untracked";

export type ChangedFile = {
  path: string;
  status: string;
  source: ChangedFileSource;
};

export type CommitGroup = {
  name: string;
  files: ChangedFile[];
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

function normalizeFolder(folder: string): string {
  return folder
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export function parseCommitRequest(args?: string): CommitRequest {
  const trimmed = args?.trim() ?? "";
  if (!trimmed) return { mode: "single" };

  const tokens = trimmed.split(/\s+/);
  if (tokens[0]?.toLowerCase() !== "split") {
    return { mode: "single", userHint: trimmed };
  }

  const folders = Array.from(
    new Set(tokens.slice(1).map(normalizeFolder).filter(Boolean)),
  );

  return { mode: "split", folders };
}

function groupNameForPath(path: string): string {
  const slashIndex = path.indexOf("/");
  return slashIndex === -1 ? "root" : path.slice(0, slashIndex);
}

function isInsideFolder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

export function buildCommitGroups(
  files: ChangedFile[],
  folders: string[],
): { groups: CommitGroup[]; missingFolders: string[] } {
  if (folders.length > 0) {
    const groups = folders
      .map((folder) => ({
        name: folder,
        files: files.filter((file) => isInsideFolder(file.path, folder)),
      }))
      .filter((group) => group.files.length > 0);
    const missingFolders = folders.filter(
      (folder) => !groups.some((group) => group.name === folder),
    );

    return { groups, missingFolders };
  }

  const groupsByName = new Map<string, ChangedFile[]>();
  for (const file of files) {
    const name = groupNameForPath(file.path);
    groupsByName.set(name, [...(groupsByName.get(name) ?? []), file]);
  }

  const groups = Array.from(groupsByName, ([name, groupFiles]) => ({
    name,
    files: groupFiles,
  })).sort((a, b) => a.name.localeCompare(b.name));

  return { groups, missingFolders: [] };
}

export type GitContext = {
  branch: string;
  stagedStat: string;
  stagedDiff: string;
  unstagedStat: string;
  unstagedDiff: string;
  changedFiles: ChangedFile[];
  untrackedFiles: string[];
  recentCommits: string[];
  hasUncommittedChanges: boolean;
};
