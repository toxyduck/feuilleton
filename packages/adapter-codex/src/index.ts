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

export async function transformCodexMessage(
  raw: string,
  state: Map<string, ItemState>,
  cwd = process.cwd(),
): Promise<string> {
  let message: any;
  try {
    message = JSON.parse(raw);
  } catch {
    return raw;
  }
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
        renderer: new MessageRenderer(config, store),
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
        params.item.text = await new MessageRenderer(config, store).push(
          params.item.text,
          true,
        );
      } finally {
        store.close();
      }
    }
    return JSON.stringify(message);
  }
  return raw;
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
      if (binary) {
        client.send(data, { binary: true });
        return;
      }
      const raw = data.toString();
      chain = chain
        .then(async () => {
          const transformed = await transformCodexMessage(raw, state, cwd);
          if (client.readyState === WebSocket.OPEN) client.send(transformed);
        })
        .catch(() => {
          if (client.readyState === WebSocket.OPEN) client.send(raw);
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
