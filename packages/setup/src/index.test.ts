import { expect, test } from "bun:test";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { findOriginalCodex } from "./index.ts";

test("skips current and previous Feuilleton launchers on PATH", () => {
  const root = mkdtempSync(join(tmpdir(), "ftn-setup-"));
  const currentDir = join(root, "current");
  const previousDir = join(root, "previous");
  const invalidDir = join(root, "invalid");
  const realDir = join(root, "real");
  for (const directory of [currentDir, previousDir, invalidDir, realDir])
    mkdirSync(directory);

  const currentLauncher = join(currentDir, "ftn-codex");
  const previousLauncher = join(previousDir, "ftn-codex");
  const realCodex = join(realDir, "codex");
  for (const executable of [currentLauncher, previousLauncher, realCodex]) {
    writeFileSync(executable, "#!/bin/sh\n");
    chmodSync(executable, 0o755);
  }
  symlinkSync(currentLauncher, join(currentDir, "codex"));
  symlinkSync(previousLauncher, join(previousDir, "codex"));
  writeFileSync(join(invalidDir, "codex"), "not executable\n");

  const pathValue = [currentDir, previousDir, invalidDir, realDir].join(
    delimiter,
  );
  expect(findOriginalCodex(currentLauncher, pathValue)).toBe(
    realpathSync(realCodex),
  );
});
