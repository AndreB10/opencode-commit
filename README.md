# @andre-barbosa/opencode-commit

OpenCode plugin that generates **Conventional Commits** messages from uncommitted git changes using a model you choose.

Run `/commit` in the OpenCode TUI to get a suggested message like `feat(auth): add oauth login flow` — copy it and commit manually.

## Features

- `/commit` slash command (display only, no auto-commit)
- Dedicated model for commit message generation
- Conventional Commits format enforced (`feat(scope): ...`, `fix(scope): ...`, etc.)
- Optional hint: `/commit emphasize breaking API change`
- Uses staged diffs, unstaged diffs, non-ignored untracked filenames, branch name, and recent commit subjects for context

## Requirements

- [OpenCode](https://opencode.ai/) with plugin support
- A git repository with uncommitted changes

## Installation

### Configure the plugin

**Local development** (this repo):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "file:///C:/absolute/path/to/opencode-commit/src/index.ts",
      {
        "model": "opencode-go/deepseek-v4-flash",
        "maxDiffChars": 12000
      }
    ]
  ]
}
```

**From npm:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["@andre-barbosa/opencode-commit", { "model": "opencode-go/deepseek-v4-flash" }]
  ]
}
```

See [opencode.example.json](opencode.example.json) for a full example.

Run `opencode models` to list available models.
Restart OpenCode after editing config.

## Usage

1. Make changes in a git repository. Staging is optional.
2. Open OpenCode in the project.
3. Run `/commit`.
4. Copy the suggested message and commit: `git commit -m "feat(scope): ..."`.

Optional extra instruction:

```text
/commit focus on test coverage improvements
```

## Plugin options

When loading the plugin as a tuple `[name, options]`:

| Option | Default | Description |
| --- | --- | --- |
| `model` | required | Model to use in `provider/model-id` format |
| `maxDiffChars` | `12000` | Max tracked diff characters sent across staged and unstaged diffs |

## Change scope

`/commit` analyzes:

- Staged tracked changes from `git diff --staged`
- Unstaged tracked changes from `git diff`
- Non-ignored untracked filenames from `git ls-files --others --exclude-standard`

It does not read untracked file contents and does not ask Git for ignored files.

## Commit message format

Generated messages follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short imperative description

- optional bullet body
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

## Project layout

```
opencode-commit/
├── src/                  # plugin source
├── commands/             # optional /commit command stub
└── opencode.example.json
```

## License

MIT
