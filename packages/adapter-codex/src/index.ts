import { createServer } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { loadConfig } from "@feuilleton/config";
import { ArtifactStore } from "@feuilleton/artifacts";
import { MessageRenderer } from "@feuilleton/renderer";

interface ItemState {
  renderer: MessageRenderer;
  rendered: string;
  store: ArtifactStore;
}

const INTERNAL_HOOK_STATUS = "FTN_INTERNAL_CONTEXT";

function isFeuilletonHook(run: any): boolean {
  if (run?.statusMessage === INTERNAL_HOOK_STATUS) return true;
  if (run?.source !== "plugin" || typeof run?.sourcePath !== "string")
    return false;
  const path = String(run.sourcePath).replaceAll("\\", "/").toLowerCase();
  return path.includes("/feuilleton/") && path.endsWith("/hooks/hooks.json");
}

function suppressCodexNotification(message: any): boolean {
  if (
    message?.method !== "hook/started" &&
    message?.method !== "hook/completed"
  )
    return false;
  const run = message?.params?.run;
  return (
    isFeuilletonHook(run) &&
    (message.method === "hook/started" || run.status === "completed")
  );
}

export async function transformCodexMessage(
  raw: string,
  state: Map<string, ItemState>,
  cwd = process.cwd(),
  columns: () => number = () => loadConfig(cwd).terminal.fallbackColumns,
): Promise<string | undefined> {
  let message: any;
  try {
    message = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (suppressCodexNotification(message)) return undefined;
  const params = message?.params;
  const config = loadConfig(cwd);
  if (
    message?.method === "item/agentMessage/delta" &&
    typeof params?.delta === "string"
  ) {
    const key = String(params.itemId);
    let item = state.get(key);
    if (!item) {
      const store = new ArtifactStore(config.cache);
      item = {
        renderer: new MessageRenderer(
          config,
          store,
          undefined,
          undefined,
          columns,
        ),
        rendered: "",
        store,
      };
    }
    const delta = await item.renderer.push(params.delta);
    item.rendered += delta;
    params.delta = delta;
    state.set(key, item);
    return JSON.stringify(message);
  }
  if (
    message?.method === "item/completed" &&
    params?.item?.type === "agentMessage"
  ) {
    const key = String(params.item.id);
    const item = state.get(key);
    if (item) {
      try {
        item.rendered += await item.renderer.push("", true);
        params.item.text = item.rendered;
      } finally {
        item.store.close();
        state.delete(key);
      }
    } else if (typeof params.item.text === "string") {
      const store = new ArtifactStore(config.cache);
      try {
        params.item.text = await new MessageRenderer(
          config,
          store,
          undefined,
          undefined,
          columns,
        ).push(params.item.text, true);
      } finally {
        store.close();
      }
    }
    return JSON.stringify(message);
  }
  return raw;
}

export async function transformCodexFrame(
  data: unknown,
  state: Map<string, ItemState>,
  cwd = process.cwd(),
  columns: () => number = () => loadConfig(cwd).terminal.fallbackColumns,
): Promise<string | undefined> {
  return await transformCodexMessage(
    await frameText(data),
    state,
    cwd,
    columns,
  );
}

async function frameText(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data))
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
      "utf8",
    );
  if (Array.isArray(data) && data.every((part) => Buffer.isBuffer(part)))
    return Buffer.concat(data).toString("utf8");
  if (data instanceof Blob)
    return Buffer.from(await data.arrayBuffer()).toString("utf8");
  throw new TypeError(
    `unsupported Codex WebSocket frame: ${Object.prototype.toString.call(data)}`,
  );
}

export async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export async function startCodexProxy(
  upstreamUrl: string,
  cwd = process.cwd(),
  columns: () => number = () => loadConfig(cwd).terminal.fallbackColumns,
): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  server.on("connection", (client) => {
    const upstream = new WebSocket(upstreamUrl);
    const pending: Array<{ data: Buffer; binary: boolean }> = [];
    const state = new Map<string, ItemState>();
    let chain = Promise.resolve();

    client.on("message", (data, binary) => {
      const bytes = Buffer.from(data as ArrayBuffer);
      if (upstream.readyState === WebSocket.OPEN)
        upstream.send(bytes, { binary });
      else pending.push({ data: bytes, binary });
    });
    upstream.on("open", () => {
      for (const item of pending)
        upstream.send(item.data, { binary: item.binary });
      pending.length = 0;
    });
    upstream.on("message", (data, binary) => {
      if (client.readyState !== WebSocket.OPEN) return;
      chain = chain
        .then(async () => {
          const raw = await frameText(data);
          const transformed = await transformCodexMessage(
            raw,
            state,
            cwd,
            columns,
          );
          if (process.env.FTN_DEBUG === "1") {
            let method = "<non-json>";
            try {
              method = String(JSON.parse(raw)?.method ?? "<response>");
            } catch {
              method = "<non-json>";
            }
            if (method.includes("agentMessage") || raw.includes("<ftn"))
              process.stderr.write(
                `ftn-codex: frame type=${Object.prototype.toString.call(data)} binary=${String(binary)} method=${method} transformed=${String(transformed !== raw)}\n`,
              );
          }
          if (transformed !== undefined && client.readyState === WebSocket.OPEN)
            client.send(transformed, { binary });
        })
        .catch((error) => {
          process.stderr.write(
            `ftn-codex: failed to transform server message: ${error instanceof Error ? error.message : String(error)}\n`,
          );
          if (client.readyState === WebSocket.OPEN)
            client.send(data, { binary });
        });
    });
    const closeState = (): void => {
      for (const item of state.values()) item.store.close();
      state.clear();
    };
    client.on("close", () => {
      closeState();
      upstream.close();
    });
    upstream.on("close", () => {
      closeState();
      client.close();
    });
    client.on("error", () => upstream.terminate());
    upstream.on("error", () => client.close(1011, "upstream unavailable"));
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    port,
    close: () =>
      new Promise((resolve) => {
        for (const client of server.clients) client.terminate();
        server.close(() => resolve());
      }),
  };
}

export { handleCodexHook } from "./hook.ts";
