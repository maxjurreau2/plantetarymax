export class SubstrateDO {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Basic health check
    if (path === "/healthz") {
      return new Response(
        JSON.stringify({
          ok: true,
          ts: Date.now() / 1000,
          note: "SubstrateDO alive",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Optional: read kernel status if configured
    if (path === "/kernel/status") {
      try {
        if (this.env.KERNEL_STATUS_URL) {
          const res = await fetch(this.env.KERNEL_STATUS_URL);
          const json = await res.json();
          return new Response(JSON.stringify(json), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Dev fallback: read from DO storage
        const status = await this.state.storage.get("kernel_status");
        return new Response(JSON.stringify(status || { phase: "unknown" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "status_unavailable" }),
          { status: 500 }
        );
      }
    }

    // Optional: write kernel status (dev only)
    if (path === "/kernel/status" && request.method === "POST") {
      try {
        const body = await request.json();
        await this.state.storage.put("kernel_status", body);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response("invalid json", { status: 400 });
      }
    }

    return new Response("not found", { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: any) {
    const id = env.SUBSTRATE_DO.idFromName("root");
    const obj = env.SUBSTRATE_DO.get(id);
    return obj.fetch(request);
  },
};
