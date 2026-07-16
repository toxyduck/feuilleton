import { chmodSync, cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";
import { WIDGET_NAMES } from "../packages/core/src/index.ts";

type BuildTarget =
  | "bun-darwin-arm64"
  | "bun-darwin-x64"
  | "bun-linux-arm64"
  | "bun-linux-x64-baseline";

const target = process.env.FTN_TARGET as BuildTarget | undefined;
const output = join("dist", target ?? `${process.platform}-${process.arch}`);
const bin = join(output, "bin");
mkdirSync(bin, { recursive: true });

for (const [name, entrypoint] of [
  ["ftn", "apps/ftn/src/main.ts"],
  ["ftn-codex", "apps/ftn-codex/src/main.ts"],
] as const) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    compile: target
      ? { target, outfile: join(bin, name) }
      : { outfile: join(bin, name) },
    minify: true,
    sourcemap: "linked",
    define: {
      __FTN_VERSION__: JSON.stringify(process.env.FTN_VERSION ?? pkg.version),
    },
  });
  if (!result.success)
    throw new AggregateError(result.logs, `failed to compile ${name}`);
}

for (const widget of WIDGET_NAMES) {
  const wrapper = join(bin, `ftn-${widget}`);
  writeFileSync(
    wrapper,
    `#!/bin/sh\nexec "$(dirname "$0")/ftn" ${widget} "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
}

cpSync("integrations", join(output, "share", "feuilleton", "integrations"), {
  recursive: true,
});
