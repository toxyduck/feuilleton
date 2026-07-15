# Feuilleton

Feuilleton embeds Bash-generated, terminal-aware visualizations in the official
Codex and Claude Code terminal interfaces.

## Status

This repository contains the first working implementation. Claude integration
uses the official `MessageDisplay` hook. Codex uses its official TUI connected
to a local `app-server` through a transparent protocol proxy.

## Development

Requirements: Bun 1.2 or newer.

```bash
bun install
bun run typecheck
bun run lint
bun test
bun run build
```

Every pull request runs type checking, linting, formatting checks, tests on
Linux and macOS, plugin validation, and standalone compilation for macOS and
Linux on arm64 and x64.

## Architecture

```text
core
 ├── config
 ├── artifacts ── context
 └── executor ─── renderer

config + artifacts + renderer + context
 ├── adapter-claude ── Claude plugin
 └── adapter-codex  ── ftn-codex launcher

config + artifacts + executor + context + setup + widgets
 └── cli ── ftn
```

- `core` owns the streaming `<ftn>` parser and shared types.
- `config` loads trusted user and project configuration.
- `executor` runs Bash with terminal capabilities supplied through the
  environment.
- `artifacts` stores complete results in a SQLite-backed LRU cache.
- `renderer` replaces directives without depending on a specific agent.
- Agent adapters only translate their native event protocols.
- `widgets` provides plot, tree, and DOT/Graphviz rendering.

## Configuration

User configuration lives at `~/.feuilleton/config.toml`. A project may provide
`.feuilleton/config.toml`; activate it with `ftn trust`.

```toml
[execution]
mode = "inline" # or "tool"
shell = "bash"
timeout_seconds = 30

[widgets.bars]
command = "ftn-bars"
description = """
Render a responsive bar chart from tab-separated input.

Example:
<ftn>
printf 'api\t42\nweb\t31\n' | ftn-bars
</ftn>
"""
```

## Agent setup

```bash
ftn setup codex
ftn setup claude
```

The integrations are independent. Remove one with `ftn remove codex` or
`ftn remove claude`.

## Protocol

Inline mode executes the Bash body after the tag closes:

```xml
<ftn>
printf 'api\t42\nweb\t31\n' | ftn-bars
</ftn>
```

Tool mode preserves native agent permissions:

```bash
ftn run <<'FTN'
printf 'api\t42\nweb\t31\n' | ftn-bars
FTN
```

The command returns a compact reference such as `<ftn art="k7m2qd8x"/>`.

## Built-in widgets

The standalone binary exposes three composable commands:

```bash
printf 'Jan\t12\nFeb\t19\n' | ftn-plot bar
printf 'src/api.ts\nsrc/ui.ts\n' | ftn-tree
printf 'digraph { api -> database }\n' | ftn-graph
```

`ftn-graph` bundles Graphviz WebAssembly and accepts the standard DOT language;
users do not need to install Graphviz separately.
