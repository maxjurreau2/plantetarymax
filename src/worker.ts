import { BrokerDO } from "./broker_do";
import { SubstrateDO } from "./substrate_do";

export { BrokerDO, SubstrateDO };

//
// ============================================================
// PIPELINE LAYER
// ============================================================
//

// Unified pipeline runner
async function runPipeline(request, env, context, middleware) {
  for (const fn of middleware) {
    const result = await fn(request, env, context);
    if (result instanceof Response) return result; // early exit
  }
  return null;
}

// Logging middleware (structural)
async function mwLog(request, env, context) {
  const url = new URL(request.url);

  context.request = {
    ts: Date.now(),
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    id: crypto.randomUUID(),
  };

  console.log(JSON.stringify({ event: "request", ...context.request }));
}

// Correlation ID middleware
async function mwCorrelation(request, env, context) {
  context.correlationId = crypto.randomUUID();
}

// Metrics middleware factory
function mwMetric(name) {
  return async (request, env, context) => {
    try {
      env.METRICS?.increment(name);
    } catch {}
  };
}

// Auth middleware (only for protected routes)
async function mwAuth(request, env, context) {
  const auth =
    request.headers.get("Authorization") ||
    request.headers.get("authorization") ||
    "";

  let token = null;
  if (auth.toLowerCase().startsWith("bearer "))
    token = auth.split(/\s+/, 2)[1];
  if (!token) token = request.headers.get("x-events-token");

  if (!token || token !== env.EVENTS_PUBLISH_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }
}

//
// ============================================================
// HANDLER LAYER (pure functions)
// ============================================================
//

async function hEventsSSE(request, env, context) {
  const params = new URL(request.url).searchParams;
  const channel = params.get("channel") || "global";

  const id = env.BrokerDO.idFromName(channel);
  return env.BrokerDO.get(id).fetch(request);
}

async function hEventsPublish(request, env, context) {
  const params = new URL(request.url).searchParams;
  const payload = await request.json();

  const channel =
    payload.channel ||
    params.get("channel") ||
    "global";

  const id = env.BrokerDO.idFromName(channel);

  return env.BrokerDO.get(id).fetch("/_broadcast", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

async function hEventsSnapshot(request, env, context) {
  const params = new URL(request.url).searchParams;
  const channel = params.get("channel") || "global";

  const id = env.BrokerDO.idFromName(channel);
  return env.BrokerDO.get(id).fetch("/events/snapshot");
}

function substrate(env) {
  const id = env.SubstrateDO.idFromName("substrate");
  return env.SubstrateDO.get(id);
}

async function hSubstrate(request, env, context) {
  return substrate(env).fetch(request);
}

async function hSubstrateSave(request, env, context) {
  return substrate(env).fetch(request);
}

async function hSubstrateLoad(request, env, context) {
  return substrate(env).fetch(request);
}

function hHealth() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function hDebugRoutes() {
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
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

//
// ============================================================
// ROUTER LAYER (declarative)
// ============================================================
//

const ROUTES = {
  "/events/sse": {
    handler: hEventsSSE,
    middleware: [mwMetric("events_sse")],
  },
  "/events/publish": {
    handler: hEventsPublish,
    middleware: [mwAuth, mwMetric("events_publish")],
  },
  "/events/snapshot": {
    handler: hEventsSnapshot,
    middleware: [mwMetric("events_snapshot")],
  },

  "/substrate": {
    handler: hSubstrate,
    middleware: [mwMetric("substrate_read")],
  },
  "/substrate/save": {
    handler: hSubstrateSave,
    middleware: [mwMetric("substrate_save")],
  },
  "/substrate/load": {
    handler: hSubstrateLoad,
    middleware: [mwMetric("substrate_load")],
  },

  "/healthz": {
    handler: hHealth,
    middleware: [],
  },
  "/debug/routes": {
    handler: hDebugRoutes,
    middleware: [],
  },
};

//
// ============================================================
// MAIN WORKER
// ============================================================
//

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname];

    if (!route) return new Response("not found", { status: 404 });

    const context = {};

    // Global middleware
    const globalMW = [mwCorrelation, mwLog];
    const globalResult = await runPipeline(request, env, context, globalMW);
    if (globalResult) return globalResult;

    // Route-specific middleware
    const routeResult = await runPipeline(request, env, context, route.middleware);
    if (routeResult) return routeResult;

    // Handler
    return route.handler(request, env, context);
  },
};

