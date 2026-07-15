# Feuilleton

[![Pull request](https://github.com/toxyduck/feuilleton/actions/workflows/pull-request.yml/badge.svg)](https://github.com/toxyduck/feuilleton/actions/workflows/pull-request.yml)
[![Homebrew installs](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftoxyduck%2Ffeuilleton%2Fmetrics%2Fhomebrew.json)](https://formulae.brew.sh/analytics/)

Feuilleton adds terminal-native plots, trees, graphs, and Bash-generated output
to the official Codex and Claude Code interfaces.

## Install

Install the public Homebrew package in one command:

```bash
brew install toxyduck/tap/feuilleton
```

Connect either agent without changing how it is launched:

```bash
ftn setup codex
ftn setup claude
```

Continue to start the agents normally with `codex` or `claude`. Check an
installation with `ftn doctor codex` or `ftn doctor claude`.

## Use

Tool mode is the default. It preserves the native approval flow of the agent:

```bash
ftn run <<'FTN'
printf 'api\t42\nweb\t31\n' | ftn-plot bar
FTN
```

The command returns a compact reference such as `<ftn art="k7m2qd8x"/>`.
Putting that reference in the model response replaces it with the generated
output and a compact `[output]` link to the stored result.

Feuilleton ships three composable widgets:

```bash
printf 'Jan\t12\nFeb\t19\n' | ftn-plot bar       # bar, line, scatter
printf 'src/api.ts\nsrc/ui.ts\n' | ftn-tree
printf 'digraph { api -> database }\n' | ftn-graph
```

`ftn-graph` accepts DOT and bundles Graphviz WebAssembly. Ordinary Bash tools
remain available, so a widget is unnecessary when a short command already
produces good terminal output.

## Display behavior

Feuilleton inserts text into the existing agent transcript; it does not create
a separate window. The agent TUI owns scrolling and may reflow old output when
its content area changes. Rendering happens once and is not repeated after a
terminal resize.

The runtime detects terminal width, reserves a four-column safety inset, and
passes the remaining width to scripts as `FTN_COLUMNS`. It never truncates the
overall output height. Scripts also receive `FTN_UNICODE` and `FTN_COLOR`; the
model does not need to specify terminal dimensions.

## Configuration

User configuration lives at `~/.feuilleton/config.toml`. Project configuration
may live at `.feuilleton/config.toml` and must be activated with `ftn trust`.

```toml
[execution]
mode = "tool" # or "inline"
shell = "bash"
timeout_seconds = 30

[terminal]
fallback_columns = 80
horizontal_inset = 4
```

Custom widgets contain a command and a short English description with an
example call. The description is included in the model context.

```toml
[widgets.disk]
command = "disk-chart"
description = "TSV mount<TAB>percent. Example: df-data | disk-chart."
```

## Troubleshooting

If a hook reports exit code 127, confirm that `ftn`, `ftn-plot`, `ftn-tree`, and
`ftn-graph` are on `PATH`, then rerun setup and restart the agent:

```bash
ftn setup codex
ftn doctor codex
```

Remove an integration with `ftn remove codex` or `ftn remove claude`.

## Development

Requires Bun 1.2 or newer.

```bash
bun install
bun run typecheck
bun run lint
bun run format:check
bun run check:deps
bun test
bun run build
```

Pull requests run the same checks, test Linux and macOS, validate both plugins,
and compile standalone binaries for macOS and Linux on arm64 and x64.
