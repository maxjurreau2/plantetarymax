import { BrokerDO } from "./broker_do";
import { SubstrateDO } from "./substrate_do";

export { BrokerDO, SubstrateDO };

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    //
    // ------------------------------------------------------------
    // EVENTS → BrokerDO
    // ------------------------------------------------------------
    //
    if (pathname === "/events/sse") {
      const channel = url.searchParams.get("channel") || "global";
      const id = env.BrokerDO.idFromName(channel);
      const obj = env.BrokerDO.get(id);
      return obj.fetch(request);
    }

    if (pathname === "/events/publish" && method === "POST") {
      const auth =
        request.headers.get("Authorization") ||
        request.headers.get("authorization") ||
        "";

      let token: string | null = null;
      if (auth.toLowerCase().startsWith("bearer "))
        token = auth.split(/\s+/, 2)[1];
      if (!token) token = request.headers.get("x-events-token");

      if (!token || token !== env.EVENTS_PUBLISH_TOKEN) {
        return new Response("unauthorized", { status: 401 });
      }

      const payload = await request.json();
      const channel =
        payload.channel ||
        url.searchParams.get("channel") ||
        "global";

      const id = env.BrokerDO.idFromName(channel);
      const obj = env.BrokerDO.get(id);

      return obj.fetch("/_broadcast", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/events/snapshot") {
      const channel = url.searchParams.get("channel") || "global";
      const id = env.BrokerDO.idFromName(channel);
      const obj = env.BrokerDO.get(id);
      return obj.fetch("/events/snapshot");
    }

    //
    // ------------------------------------------------------------
    // SUBSTRATE → SubstrateDO
    // ------------------------------------------------------------
    //
    if (pathname === "/substrate") {
      const id = env.SubstrateDO.idFromName("substrate");
      const obj = env.SubstrateDO.get(id);
      return obj.fetch(request);
    }

    if (pathname === "/substrate/save" && method === "POST") {
      const id = env.SubstrateDO.idFromName("substrate");
      const obj = env.SubstrateDO.get(id);
      return obj.fetch(request);
    }

    if (pathname === "/substrate/load") {
      const id = env.SubstrateDO.idFromName("substrate");
      const obj = env.SubstrateDO.get(id);
      return obj.fetch(request);
    }

    //
    // ------------------------------------------------------------
    // HEALTH CHECK
    // ------------------------------------------------------------
    //
    if (pathname === "/healthz") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    //
    // ------------------------------------------------------------
    // DEBUG ROUTES
    // ------------------------------------------------------------
    //
    if (pathname === "/debug/routes") {
      return new Response(
        JSON.stringify({
          routes: [
            "/events/sse",
            "/events/publish",
            "/events/snapshot",
            "/substrate",
            "/substrate/save",
            "/substrate/load",
            "/healthz",
            "/debug/routes",
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    //
    // ------------------------------------------------------------
    // FALLBACK
    // ------------------------------------------------------------
    //
    return new Response("not found", { status: 404 });
  },
};
