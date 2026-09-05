import { BrokerDO } from "./broker_do";
import { SubstrateDO } from "./substrate_do";

export { BrokerDO, SubstrateDO };

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const method = request.method;

    //
    // ------------------------------------------------------------
    // ROUTE TABLE (clean, declarative)
    // ------------------------------------------------------------
    //
    const routes: Record<string, Function> = {
      "/events/sse": () => handleEventsSSE(request, env, searchParams),
      "/events/publish": () => handleEventsPublish(request, env, searchParams),
      "/events/snapshot": () => handleEventsSnapshot(request, env, searchParams),

      "/substrate": () => handleSubstrate(request, env),
      "/substrate/save": () => handleSubstrateSave(request, env),
      "/substrate/load": () => handleSubstrateLoad(request, env),

      "/healthz": () => handleHealth(),
      "/debug/routes": () => handleDebugRoutes(),
    };

    //
    // ------------------------------------------------------------
    // ROUTE DISPATCH
    // ------------------------------------------------------------
    //
    if (routes[pathname]) {
      return routes[pathname]();
    }

    return new Response("not found", { status: 404 });
  },
};

//
// ============================================================
// EVENT HANDLERS → BrokerDO
// ============================================================
//

async function handleEventsSSE(request: Request, env: any, searchParams: URLSearchParams) {
  const channel = searchParams.get("channel") || "global";
  const id = env.BrokerDO.idFromName(channel);
  const obj = env.BrokerDO.get(id);
  return obj.fetch(request);
}

async function handleEventsPublish(request: Request, env: any, searchParams: URLSearchParams) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

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
    searchParams.get("channel") ||
    "global";

  const id = env.BrokerDO.idFromName(channel);
  const obj = env.BrokerDO.get(id);

  return obj.fetch("/_broadcast", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

async function handleEventsSnapshot(request: Request, env: any, searchParams: URLSearchParams) {
  const channel = searchParams.get("channel") || "global";
  const id = env.BrokerDO.idFromName(channel);
  const obj = env.BrokerDO.get(id);
  return obj.fetch("/events/snapshot");
}

//
// ============================================================
// SUBSTRATE HANDLERS → SubstrateDO
// ============================================================
//

function getSubstrate(env: any) {
  const id = env.SubstrateDO.idFromName("substrate");
  return env.SubstrateDO.get(id);
}

async function handleSubstrate(request: Request, env: any) {
  return getSubstrate(env).fetch(request);
}

async function handleSubstrateSave(request: Request, env: any) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  return getSubstrate(env).fetch(request);
}

async function handleSubstrateLoad(request: Request, env: any) {
  return getSubstrate(env).fetch(request);
}

//
// ============================================================
// SYSTEM ROUTES
// ============================================================
//

function handleHealth() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function handleDebugRoutes() {
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
