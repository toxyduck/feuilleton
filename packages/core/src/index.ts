export type ArtifactId = string & { readonly __artifactId: unique symbol };

export type Directive =
  | { type: "execute"; script: string; source: string }
  | { type: "artifact"; id: ArtifactId; source: string };

export type ExecutionMode = "inline" | "tool";

export interface WidgetConfig {
  command: string;
  description: string;
}

export interface RenderEnvironment {
  columns: number;
  unicode: boolean;
  color: boolean;
}

export interface ArtifactRecord {
  id: ArtifactId;
  directory: string;
  stdoutPath: string;
  stderrPath: string;
  size: number;
  exitCode: number;
  createdAt: number;
  accessedAt: number;
  delivered: boolean;
  sessionId?: string;
}

export interface ParseResult {
  segments: Array<string | Directive>;
}

const ARTIFACT_ID = /^[a-z2-7]{8}$/;

export function artifactId(value: string): ArtifactId {
  if (!ARTIFACT_ID.test(value))
    throw new Error(`invalid artifact id: ${value}`);
  return value as ArtifactId;
}

const ARTIFACT_TAG = /^<ftn\s+art="([a-z2-7]{8})"\s*\/>$/;
const ARTIFACT_TAG_PREFIX = /^<ftn\s+art="([a-z2-7]{8})"\s*\/>/;

export function parseDirective(source: string): Directive {
  const match = ARTIFACT_TAG.exec(source);
  if (match?.[1]) return { type: "artifact", id: artifactId(match[1]), source };
  if (source.startsWith("<ftn>") && source.endsWith("</ftn>")) {
    return { type: "execute", script: source.slice(5, -6), source };
  }
  throw new Error("invalid feuilleton directive");
}

export interface StreamingParserState {
  pending: string;
  script?: string;
}

export class StreamingParser {
  #pending = "";
  #script: string | undefined;

  constructor(state?: StreamingParserState) {
    this.#pending = state?.pending ?? "";
    this.#script = state?.script;
  }

  snapshot(): StreamingParserState {
    return {
      pending: this.#pending,
      ...(this.#script === undefined ? {} : { script: this.#script }),
    };
  }

  push(chunk: string, final = false): ParseResult {
    const segments: Array<string | Directive> = [];
    this.#pending += chunk;
    for (;;) {
      if (this.#script !== undefined) {
        const closeAt = this.#pending.indexOf("</ftn>");
        if (closeAt < 0) {
          if (final) {
            segments.push(`<ftn>${this.#script}${this.#pending}`);
            this.#script = undefined;
          } else {
            this.#script += this.#pending;
          }
          this.#pending = "";
          break;
        }
        const source = `<ftn>${this.#script}${this.#pending.slice(0, closeAt)}</ftn>`;
        segments.push(parseDirective(source));
        this.#script = undefined;
        this.#pending = this.#pending.slice(closeAt + 6);
        continue;
      }
      const startAt = this.#pending.indexOf("<ftn");
      if (startAt < 0) {
        const keep = final ? 0 : longestTagPrefix(this.#pending);
        const emit = this.#pending.slice(0, this.#pending.length - keep);
        if (emit) segments.push(emit);
        this.#pending = this.#pending.slice(this.#pending.length - keep);
        break;
      }
      if (startAt > 0) {
        segments.push(this.#pending.slice(0, startAt));
        this.#pending = this.#pending.slice(startAt);
      }
      if (this.#pending.startsWith("<ftn>")) {
        this.#script = "";
        this.#pending = this.#pending.slice(5);
        continue;
      }
      const artifact = ARTIFACT_TAG_PREFIX.exec(this.#pending)?.[0];
      if (artifact) {
        segments.push(parseDirective(artifact));
        this.#pending = this.#pending.slice(artifact.length);
        continue;
      }
      if (!final && !this.#pending.includes(">")) break;
      segments.push(this.#pending[0]!);
      this.#pending = this.#pending.slice(1);
    }
    return { segments };
  }
}

function longestTagPrefix(value: string): number {
  const marker = "<ftn";
  for (let size = Math.min(value.length, marker.length); size > 0; size -= 1) {
    if (marker.startsWith(value.slice(-size))) return size;
  }
  return 0;
}
