#!/usr/bin/env bun
import { runCli } from "@feuilleton/cli";

try {
  process.exitCode = await runCli();
} catch (error) {
  process.stderr.write(
    `ftn: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
