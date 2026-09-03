import { BrokerDO } from "./substrate/BrokerDO";
import { SubstrateDO } from "./substrate/SubstrateDO";

// -----------------------------
// Python Kernel RPC Helpers
// -----------------------------

async function callKernelStatus(env: any) {
  if (!env.KERNEL_STATUS_URL) {
    return { phase: "unknown", ts: Date.now() / 1000 };
  }
  const res = await fetch(env.KERNEL_STATUS_URL);
  return await res.json();
}

async function enqueueMessage(env: any, envelope: any) {
  if (!env.MESSAGE_QUEUE_RPC_URL) {
    return { ok: false, error: "queue_rpc_not_configured" };
  }
  const res = await fetch(env.MESSAGE_QUEUE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
  });
  return await res.json();
}

async function callIdentity(env: any, token: string) {
  if (!env.IDENTITY_ADAPTER_RPC) {
    return { id: "dev", roles: ["admin"] };
  }
  const res = await fetch(env.IDENTITY_ADAPTER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return await res.json();
}

async function callGovernance(env: any, action: string) {
  if (!env.GOVERNANCE_ADAPTER_RPC) {
    return { allow: true, reason: "dev-fallback" };
  }
  const res = await fetch(env.GOVERNANCE_ADAPTER_RPC + "?q=" + action);
  return await res.json();
}

// -----------------------------
// Worker Entrypoint
// -----------------------------

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Kernel status passthrough
    if (path === "/kernel/status") {
      const status = await callKernelStatus(env);
      return new Response(JSON.stringify(status), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Message enqueue → Python queue
    if (path === "/message" && request.method === "POST") {
      const envelope = await request.json();
      const result = await enqueueMessage(env, envelope);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Identity check
    if (path === "/auth") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : "";
      const principal = await callIdentity(env, token);
      return new Response(JSON.stringify(principal), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Governance check
    if (path.startsWith("/governance/check")) {
      const action = url.searchParams.get("q") || "";
      const decision = await callGovernance(env, action);
      return new Response(JSON.stringify(decision), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Route all /events/* to BrokerDO
    if (path.startsWith("/events")) {
      const channel = url.searchParams.get("channel") || "global";
      const id = env.BROKER_DO.idFromName(channel);
      const obj = env.BROKER_DO.get(id);
      return obj.fetch(request);
    }

    // Route /substrate/* to SubstrateDO
    if (path.startsWith("/substrate")) {
      const id = env.SUBSTRATE_DO.idFromName("root");
      const obj = env.SUBSTRATE_DO.get(id);
      return obj.fetch(request);
    }

    return new Response("ok");
  },
};
