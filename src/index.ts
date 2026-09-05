import { Hono } from "hono";

// -----------------------------
// Utility helpers
// -----------------------------
async function jsonSafe<T>(fn: () => Promise<T>, fallback: any) {
  try {
    return await fn();
  } catch (err) {
    return fallback;
  }
}

// -----------------------------
// Kernel Status Adapter
// -----------------------------
async function readKernelStatus(env: any) {
  // 1. External binding
  if (env.KERNEL_STATUS_URL) {
    return jsonSafe(
      async () => {
        const res = await fetch(env.KERNEL_STATUS_URL);
        return await res.json();
      },
      { phase: "unknown", source: "kernel-status-url" }
    );
  }

  // 2. Env fallback
  if (env.KERNEL_STATUS) {
    return JSON.parse(env.KERNEL_STATUS);
  }

  // 3. Dev fallback (local file written by kernel/boot.py)
  return jsonSafe(
    async () => {
      const file = await env.ASSETS.get("kernel/status.json");
      return JSON.parse(file);
    },
    { phase: "dev-fallback", updated_at: Date.now() / 1000 }
  );
}

// -----------------------------
// Message Queue Adapter
// -----------------------------
async function enqueueMessage(env: any, envelope: any) {
  // 1. External queue
  if (env.MESSAGE_QUEUE_URL) {
    const res = await fetch(env.MESSAGE_QUEUE_URL, {
      method: "POST",
      body: JSON.stringify(envelope),
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  }

  // 2. RPC queue
  if (env.MESSAGE_QUEUE_RPC_URL) {
    const res = await fetch(env.MESSAGE_QUEUE_RPC_URL, {
      method: "POST",
      body: JSON.stringify(envelope),
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  }

  // 3. In‑memory dev queue
  const id = crypto.randomUUID();
  const q = env.__DEV_QUEUE || (env.__DEV_QUEUE = []);
  q.push({ id, envelope });
  return { message_id: id, status: "queued", dev_queue_size: q.length };
}

// -----------------------------
// Identity Adapter
// -----------------------------
async function resolveIdentity(env: any, request: Request) {
  const auth = request.headers.get("Authorization");

  // 1. Dev token
  if (auth === "Bearer dev-token") {
    return { id: "dev", roles: ["admin"], mode: "dev-token" };
  }

  // 2. External identity service
  if (env.IDENTITY_URL) {
    const res = await fetch(env.IDENTITY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });
    return await res.json();
  }

  // 3. RPC identity adapter
  if (env.IDENTITY_ADAPTER_RPC_URL) {
    const res = await fetch(env.IDENTITY_ADAPTER_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });
    return await res.json();
  }

  return { id: "anonymous", roles: [], mode: "fallback" };
}

// -----------------------------
// Governance Adapter
// -----------------------------
async function checkGovernance(env: any, action: string) {
  // 1. External governance service
  if (env.GOVERNANCE_URL) {
    const res = await fetch(`${env.GOVERNANCE_URL}?q=${action}`);
    return await res.json();
  }

  // 2. RPC governance adapter
  if (env.GOVERNANCE_ADAPTER_RPC_URL) {
    const res = await fetch(env.GOVERNANCE_ADAPTER_RPC_URL, {
      method: "POST",
      body: JSON.stringify({ action }),
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  }

  // 3. Local fallback
  return { allow: true, reason: "local-fallback" };
}

// -----------------------------
// Unified Worker App
// -----------------------------
const app = new Hono();

// -----------------------------
// GET /health
// -----------------------------
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

// -----------------------------
// GET /kernel/status
// -----------------------------
app.get("/kernel/status", async (c) => {
  const status = await readKernelStatus(c.env);
  return c.json(status);
});

// -----------------------------
// POST /message
// -----------------------------
app.post("/message", async (c) => {
  const envelope = await c.req.json();

  if (!envelope.type || !envelope.body) {
    return c.json({ error: "Invalid envelope" }, 400);
  }

  const result = await enqueueMessage(c.env, envelope);
  return c.json(result);
});

// -----------------------------
// POST /auth
// -----------------------------
app.post("/auth", async (c) => {
  const principal = await resolveIdentity(c.env, c.req);
  return c.json(principal);
});

// -----------------------------
// GET /governance/check
// -----------------------------
app.get("/governance/check", async (c) => {
  const action = c.req.query("q") || "unknown";
  const decision = await checkGovernance(c.env, action);
  return c.json(decision);
});

// -----------------------------
// Default Portal‑OS dashboard
// -----------------------------
app.get("/", (c) => {
  return c.text("Portal‑OS Unified Worker — PlanetaryMax Bridge Online");
});

// -----------------------------
export default app;
