import {
  isWidgetName,
  StreamingParser,
  type Directive,
  type StreamingParserState,
  type WidgetName,
} from "@feuilleton/core";
import type { FeuilletonConfig } from "@feuilleton/config";
import type { ArtifactStore } from "@feuilleton/artifacts";
import { executeScript } from "@feuilleton/executor";
import { runWidget } from "@feuilleton/widgets";

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
  readonly #columns: () => number;

  constructor(
    config: FeuilletonConfig,
    store: ArtifactStore,
    sessionId?: string,
    parserState?: StreamingParserState,
    columns: () => number = () => config.terminal.fallbackColumns,
  ) {
    this.#config = config;
    this.#store = store;
    this.#sessionId = sessionId;
    this.#columns = columns;
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
      const record = this.#store.get(directive.id);
      if (!record) return `[feuilleton: artifact ${directive.id} expired]\n`;
      const widget = widgetPayload(this.#store.readMetadata(record));
      if (widget) {
        try {
          const columns = Math.max(20, Math.floor(this.#columns()));
          const output = await runWidget(
            widget.name,
            widget.input,
            widget.args,
            { columns },
          );
          const captured = this.#store.readStdout(record);
          const composed = captured.includes("\u001eFTN_WIDGET\u001e")
            ? captured.replace("\u001eFTN_WIDGET\u001e", output)
            : output;
          const path = this.#store.writeVariant(
            record,
            `${widget.name}-${columns}`,
            composed,
          );
          return `${sanitizeTerminalText(composed)}\n[output](<${path}>)\n`;
        } catch (error) {
          return `[feuilleton: ${widget.name} failed: ${error instanceof Error ? error.message : String(error)}]\n`;
        }
      }
      const stdout = this.#store.readStdout(record);
      return `${sanitizeTerminalText(stdout)}\n[output](<${record.stdoutPath}>)\n`;
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

interface WidgetPayload {
  version: 1;
  name: WidgetName;
  args: string[];
  input: string;
}

function widgetPayload(
  metadata: Record<string, unknown> | undefined,
): WidgetPayload | undefined {
  const value = metadata?.widget as Record<string, unknown> | undefined;
  if (
    value?.version !== 1 ||
    !isWidgetName(value.name) ||
    !Array.isArray(value.args) ||
    !value.args.every((arg) => typeof arg === "string") ||
    typeof value.input !== "string"
  )
    return undefined;
  return value as unknown as WidgetPayload;
}
