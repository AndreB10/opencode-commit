# opencode-commit

OpenCode plugin that generates **Conventional Commits** messages from staged git changes using a dedicated sub-agent on a model you choose.

Run `/commit` in the OpenCode TUI to get a suggested message like `feat(auth): add oauth login flow` — copy it and commit manually.

## Features

- `/commit` slash command (display only, no auto-commit)
- Dedicated hidden `commit-writer` sub-agent with its own model
- Conventional Commits format enforced (`feat(scope): ...`, `fix(scope): ...`, etc.)
- Optional hint: `/commit emphasize breaking API change`
- Uses staged diff, branch name, and recent commit subjects for context

## Requirements

- [OpenCode](https://opencode.ai/) with plugin support
- A git repository with staged changes

## Installation

### 1. Copy agent and command templates

```bash
mkdir -p .opencode/agents .opencode/commands
cp agents/commit-writer.md .opencode/agents/commit-writer.md
cp commands/commit.md .opencode/commands/commit.md
```

### 2. Configure the plugin

**Local development** (this repo):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "file:///C:/absolute/path/to/opencode-commit/src/index.ts",
      {
        "agent": "commit-writer",
        "maxDiffChars": 12000
      }
    ]
  ],
  "agent": {
    "commit-writer": {
      "model": "anthropic/claude-haiku-4-20250514"
    }
  }
}
```

**From npm** (when published):

```json
{
  "plugin": [
    ["opencode-commit", { "agent": "commit-writer" }]
  ]
}
```

See [opencode.example.json](opencode.example.json) for a full example.

### 3. Set your model

Edit the model on the `commit-writer` agent in `opencode.json` or in `.opencode/agents/commit-writer.md`:

```yaml
model: anthropic/claude-haiku-4-20250514
```

Run `opencode models` to list available models.

## Usage

1. Stage your changes: `git add ...`
2. Open OpenCode in the project
3. Run `/commit`
4. Copy the suggested message and commit: `git commit -m "feat(scope): ..."`

Optional extra instruction:

```text
/commit focus on test coverage improvements
```

## Plugin options

When loading the plugin as a tuple `[name, options]`:

| Option | Default | Description |
| --- | --- | --- |
| `agent` | `commit-writer` | Sub-agent name to invoke |
| `maxDiffChars` | `12000` | Max staged diff characters sent to the sub-agent |

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
├── agents/               # commit-writer sub-agent template
├── commands/             # /commit command stub
└── opencode.example.json
```

## License

MIT
