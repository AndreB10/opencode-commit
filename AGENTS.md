# Agent Notes: opencode-commit

This is an **OpenCode plugin** (not a standalone app) that adds a `/commit` slash command. It is published as `@andre-barbosa/opencode-commit`.

## Essential commands

- `npm run typecheck` — validate TypeScript without emitting.
- `npm run build` — compile `src/` to `dist/` (ESM, `.js` + `.d.ts`).
- `npm run prepack` / `npm run prepublishOnly` — build + typecheck before publish.

There are **no tests, lint, or formatter scripts** in this repo.

## Local development / verification

1. Make source changes in `src/`.
2. Run `npm run build` so `dist/` reflects the changes.
3. Configure OpenCode locally with the **absolute file URL** to the built entrypoint:

   ```json
   {
     "plugin": [
       [
         "file:///C:/absolute/path/to/opencode-commit/dist/index.js",
         { "model": "opencode-go/deepseek-v4-flash" }
       ]
     ]
   }
   ```

4. Restart OpenCode and run `/commit` in a git worktree with uncommitted changes.

The published package entrypoint is `dist/index.js` (see `package.json` `main`/`exports`).

## Architecture

- `src/index.ts` — plugin registration and `/commit` command execution flow.
- `src/git.ts` — gathers git context (staged/unstaged diffs, stats, branch, recent commits, untracked filenames).
- `src/prompt.ts` — builds the LLM prompt and enforces Conventional Commits format.
- `src/generate.ts` — creates an OpenCode child session and prompts the configured model.
- `src/types.ts` — config parsing, request parsing (`/commit`, `/commit split`, hints), and file grouping logic.
- `commands/commit.md` — OpenCode command stub/metadata only; logic lives in `src/index.ts`.

## Key conventions

- ESM only (`"type": "module"`); always import `.js` extensions internally even for `.ts` source.
- The `model` plugin option is **required** and must be `provider/model-id`.
- `maxDiffChars` defaults to `12000`; diffs are split between staged and unstaged.
- The plugin suggests messages/plans only; it never stages files or runs `git commit`.
- Untracked file **names** are sent to the LLM, but their contents are not read.
- The `/commit` command is implemented via the `command.execute.before` hook: set `output.parts` and return normally. Do not throw to short-circuit execution, and do not mark it as `subtask`.
