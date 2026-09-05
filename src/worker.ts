import { BrokerDO } from "./broker_do";
import { SubstrateDO } from "./substrate_do";

// Cloudflare needs these exports to bind DO classes
export { BrokerDO, SubstrateDO };

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    //
    // EVENTS ROUTES → BrokerDO
    //
    if (pathname.startsWith("/events/")) {
      const channel = url.searchParams.get("channel") || "global";
      const id = env.BrokerDO.idFromName(channel);
      const obj = env.BrokerDO.get(id);
      return await obj.fetch(request);
    }

    //
    // SUBSTRATE ROUTE → SubstrateDO
    //
    if (pathname === "/substrate") {
      const id = env.SubstrateDO.idFromName("substrate");
      const obj = env.SubstrateDO.get(id);
      return await obj.fetch(request);
    }

    //
    // HEALTH CHECK
    //
    if (pathname === "/healthz") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    //
    // DEFAULT
    //
    return new Response("ok", { status: 200 });
  },
};
