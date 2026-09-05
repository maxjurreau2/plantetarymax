import { getEnv } from "./env";
import { startTrace, logTrace, endTrace } from "./tracing";

export class BrokerDO {
  state: DurableObjectState;
  env: ReturnType<typeof getEnv>;

  constructor(state: DurableObjectState, rawEnv: any) {
    this.state = state;
    this.env = getEnv(rawEnv);
  }

  async fetch(request: Request) {
    const ctx: any = {};
    const trace = startTrace(ctx, "BrokerDO.fetch");

    const url = new URL(request.url);
    const path = url.pathname;

    logTrace(ctx, "incoming_request", { path });

    try {
      if (path === "/events/sse") return await this.traceSSE(request, ctx);
      if (path === "/_broadcast") return await this.traceBroadcast(request, ctx);
      if (path === "/events/snapshot") return await this.traceSnapshot(ctx);

      logTrace(ctx, "route_not_found", { path });
      return new Response("not found", { status: 404 });
    } finally {
      endTrace(ctx);
    }
  }

  async traceSSE(request: Request, ctx: any) {
    logTrace(ctx, "sse_start");

    const stream = new ReadableStream({
      start: (controller) => {
        const id = crypto.randomUUID();
        logTrace(ctx, "sse_client_connected", { id });

        controller.enqueue(`data: ${JSON.stringify({
          type: "connection.open",
          id,
          ts: Date.now(),
        })}\n\n`);

        const keepAlive = setInterval(() => {
          controller.enqueue(":\n\n");
        }, 20000);

        (controller as any).closed?.finally(() => {
          logTrace(ctx, "sse_client_disconnected", { id });
          clearInterval(keepAlive);
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

  async traceBroadcast(request: Request, ctx: any) {
    const payload = await request.json();
    logTrace(ctx, "broadcast_received", { payload });

    await this.state.storage.put("snapshot", payload);
    logTrace(ctx, "snapshot_saved");

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async traceSnapshot(ctx: any) {
    const snapshot = await this.state.storage.get("snapshot");
    logTrace(ctx, "snapshot_read", { snapshot });

    return new Response(JSON.stringify(snapshot ?? {}), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
