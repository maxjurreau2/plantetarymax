import { getEnv } from "./env";

export class BrokerDO {
  state: DurableObjectState;
  env: ReturnType<typeof getEnv>;
  clients: Map<string, ReadableStreamDefaultController>;
  nextId: number;

  constructor(state: DurableObjectState, rawEnv: any) {
    this.state = state;
    this.env = getEnv(rawEnv);
    this.clients = new Map();
    this.nextId = 1;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/events/sse") return this.handleSSE(request, url);
    if (path === "/_broadcast") return this.handleBroadcast(request);
    if (path === "/events/snapshot") return this.handleSnapshot();

    return new Response("not found", { status: 404 });
  }

  async handleSSE(request: Request, url: URL) {
    const stream = new ReadableStream({
      start: (controller) => {
        const id = String(this.nextId++);
        this.clients.set(id, controller);

        controller.enqueue(`data: ${JSON.stringify({
          type: "connection.open",
          id,
          ts: Date.now(),
        })}\n\n`);

        const keepAlive = setInterval(() => {
          controller.enqueue(":\n\n");
        }, 20000);

        (controller as any).closed?.finally(() => {
          clearInterval(keepAlive);
          this.clients.delete(id);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  async handleBroadcast(request: Request) {
    const payload = await request.json();
    const data = `data: ${JSON.stringify(payload)}\n\n`;

    for (const [id, controller] of this.clients.entries()) {
      try {
        controller.enqueue(data);
      } catch {
        this.clients.delete(id);
      }
    }

    await this.state.storage.put("snapshot", payload);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async handleSnapshot() {
    const snapshot = await this.state.storage.get("snapshot");
    return new Response(JSON.stringify(snapshot ?? {}), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
