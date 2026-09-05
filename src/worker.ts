import { getEnv } from "./env";
import { BrokerDO } from "./broker_do";
import { SubstrateDO } from "./substrate_do";

export { BrokerDO, SubstrateDO };

export default {
  async fetch(request: Request, rawEnv: any) {
    const env = getEnv(rawEnv);
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/events/sse") {
      const channel = url.searchParams.get("channel") || "global";
      const id = env.BrokerDO.idFromName(channel);
      return env.BrokerDO.get(id).fetch(request);
    }

    if (path === "/events/publish") {
      const token = request.headers.get("x-events-token");
      if (!token || token !== env.EVENTS_PUBLISH_TOKEN) {
        return new Response("unauthorized", { status: 401 });
      }

      const channel = url.searchParams.get("channel") || "global";
      const id = env.BrokerDO.idFromName(channel);
      return env.BrokerDO.get(id).fetch("/_broadcast", {
        method: "POST",
        body: await request.text(),
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/events/snapshot") {
      const channel = url.searchParams.get("channel") || "global";
      const id = env.BrokerDO.idFromName(channel);
      return env.BrokerDO.get(id).fetch("/events/snapshot");
    }

    if (path.startsWith("/substrate")) {
      const id = env.SubstrateDO.idFromName("substrate");
      return env.SubstrateDO.get(id).fetch(request);
    }

    if (path === "/healthz") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  },
};
