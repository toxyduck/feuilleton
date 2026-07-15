import {
  StreamingParser,
  type Directive,
  type StreamingParserState,
} from "@feuilleton/core";
import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactStore } from "@feuilleton/artifacts";
import { executeScript } from "@feuilleton/executor";

const ANSI =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function sanitizeTerminalText(value: string): string {
  return value.replace(ANSI, "").replace(/\r(?!\n)/g, "\n");
}

export class MessageRenderer {
  readonly #parser: StreamingParser;
  readonly #config: FeuilletonConfig;
  readonly #store: ArtifactStore;
  readonly #sessionId?: string;

  constructor(
    config: FeuilletonConfig,
    store: ArtifactStore,
    sessionId?: string,
    parserState?: StreamingParserState,
  ) {
    this.#config = config;
    this.#store = store;
    this.#sessionId = sessionId;
    this.#parser = new StreamingParser(parserState);
  }

  async push(chunk: string, final = false): Promise<string> {
    const { segments } = this.#parser.push(chunk, final);
    const rendered: string[] = [];
    for (const segment of segments) {
      rendered.push(
        typeof segment === "string" ? segment : await this.#render(segment),
      );
    }
    return rendered.join("");
  }

  snapshot(): StreamingParserState {
    return this.#parser.snapshot();
  }

  async #render(directive: Directive): Promise<string> {
    if (directive.type === "artifact") {
      const stdout = this.#store.readStdout(directive.id);
      const record = this.#store.get(directive.id);
      return stdout === undefined || !record
        ? `[feuilleton: artifact ${directive.id} expired]\n`
        : `${sanitizeTerminalText(stdout)}\n[output](<${record.stdoutPath}>)\n`;
    }
    if (this.#config.execution.mode === "tool") {
      return `${directive.source}\n[feuilleton: tool mode requires \`ftn run\`]\n`;
    }
    try {
      const result = await executeScript(
        directive.script,
        this.#config,
        this.#store,
        {
          ...(this.#sessionId ? { sessionId: this.#sessionId } : {}),
        },
      );
      if (result.timedOut || result.exitCode !== 0) {
        const reason = result.timedOut
          ? "timed out"
          : `exited with status ${result.exitCode}`;
        return `${directive.source}\n[feuilleton: ${reason}]\n${sanitizeTerminalText(result.stderr)}\n`;
      }
      return `${sanitizeTerminalText(result.stdout)}\n`;
    } catch (error) {
      return `${directive.source}\n[feuilleton: ${error instanceof Error ? error.message : String(error)}]\n`;
    }
  }
}
