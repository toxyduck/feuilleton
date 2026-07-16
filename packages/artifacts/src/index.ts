import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  artifactId,
  type ArtifactId,
  type ArtifactRecord,
} from "@feuilleton/core";

interface ArtifactOptions {
  root?: string;
  maxBytes: number;
  maxEntries: number;
  ttlDays: number;
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export class ArtifactStore {
  readonly root: string;
  readonly #db: Database;
  readonly #options: ArtifactOptions;

  constructor(options: ArtifactOptions) {
    this.root = options.root ?? join(homedir(), ".cache", "feuilleton");
    this.#options = options;
    mkdirSync(this.root, { recursive: true });
    this.#db = new Database(join(this.root, "index.sqlite"), { create: true });
    this.#db.exec("PRAGMA journal_mode = WAL");
    this.#db.exec(`CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY, directory TEXT NOT NULL, stdout_path TEXT NOT NULL,
      stderr_path TEXT NOT NULL, size INTEGER NOT NULL, exit_code INTEGER NOT NULL,
      created_at INTEGER NOT NULL, accessed_at INTEGER NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0, session_id TEXT
    )`);
  }

  create(
    stdout: string,
    stderr: string,
    exitCode: number,
    metadata: Record<string, unknown> = {},
  ): ArtifactRecord {
    const id = this.#newId();
    const directory = join(this.root, id);
    const stdoutPath = join(directory, "stdout");
    const stderrPath = join(directory, "stderr");
    mkdirSync(directory, { recursive: false });
    writeFileSync(stdoutPath, stdout);
    writeFileSync(stderrPath, stderr);
    const now = Date.now();
    const meta = JSON.stringify(
      { id, exitCode, createdAt: now, ...metadata },
      null,
      2,
    );
    const size =
      Buffer.byteLength(stdout) +
      Buffer.byteLength(stderr) +
      Buffer.byteLength(meta);
    writeFileSync(join(directory, "meta.json"), meta);
    this.#db
      .query(`INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .run(
        id,
        directory,
        stdoutPath,
        stderrPath,
        size,
        exitCode,
        now,
        now,
        typeof metadata.sessionId === "string" ? metadata.sessionId : null,
      );
    this.evict();
    return this.get(artifactId(id))!;
  }

  get(id: ArtifactId): ArtifactRecord | undefined {
    const row = this.#db
      .query("SELECT * FROM artifacts WHERE id = ?")
      .get(id) as Record<string, unknown> | null;
    if (!row) return undefined;
    const now = Date.now();
    this.#db
      .query("UPDATE artifacts SET accessed_at = ? WHERE id = ?")
      .run(now, id);
    return {
      id,
      directory: String(row.directory),
      stdoutPath: String(row.stdout_path),
      stderrPath: String(row.stderr_path),
      size: Number(row.size),
      exitCode: Number(row.exit_code),
      createdAt: Number(row.created_at),
      accessedAt: now,
      delivered: Boolean(row.delivered),
      ...(row.session_id ? { sessionId: String(row.session_id) } : {}),
    };
  }

  readStdout(record: ArtifactRecord): string {
    return readFileSync(record.stdoutPath, "utf8");
  }

  readMetadata(record: ArtifactRecord): Record<string, unknown> | undefined {
    try {
      return JSON.parse(
        readFileSync(join(record.directory, "meta.json"), "utf8"),
      ) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  writeVariant(record: ArtifactRecord, key: string, content: string): string {
    if (!/^[a-z0-9-]+$/.test(key))
      throw new Error("invalid artifact variant key");
    const path = join(record.directory, `render-${key}`);
    writeFileSync(path, content);
    return path;
  }

  undelivered(sessionId?: string): ArtifactRecord[] {
    const query = sessionId
      ? "SELECT id FROM artifacts WHERE delivered = 0 AND session_id = ? ORDER BY created_at"
      : "SELECT id FROM artifacts WHERE delivered = 0 ORDER BY created_at";
    const rows = (
      sessionId
        ? this.#db.query(query).all(sessionId)
        : this.#db.query(query).all()
    ) as Array<{ id: string }>;
    const records = rows
      .map(({ id }) => this.get(artifactId(id)))
      .filter((value): value is ArtifactRecord => Boolean(value));
    if (rows.length) {
      const placeholders = rows.map(() => "?").join(",");
      this.#db
        .query(
          `UPDATE artifacts SET delivered = 1 WHERE id IN (${placeholders})`,
        )
        .run(...rows.map(({ id }) => id));
    }
    return records;
  }

  evict(): void {
    const cutoff = Date.now() - this.#options.ttlDays * 86_400_000;
    const rows = this.#db
      .query(
        "SELECT id, directory, size, created_at FROM artifacts ORDER BY accessed_at DESC",
      )
      .all() as Array<{
      id: string;
      directory: string;
      size: number;
      created_at: number;
    }>;
    let total = 0;
    rows.forEach((row, index) => {
      total += row.size;
      if (
        row.created_at < cutoff ||
        index >= this.#options.maxEntries ||
        total > this.#options.maxBytes
      ) {
        rmSync(row.directory, { recursive: true, force: true });
        this.#db.query("DELETE FROM artifacts WHERE id = ?").run(row.id);
      }
    });
  }

  close(): void {
    this.#db.close();
  }

  #newId(): string {
    for (;;) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      let id = "";
      for (let index = 0; index < 8; index += 1)
        id += ALPHABET[bytes[index]! & 31];
      if (!this.#db.query("SELECT 1 FROM artifacts WHERE id = ?").get(id))
        return id;
    }
  }
}
