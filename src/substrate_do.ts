import { getEnv } from "./env";
import { startTrace, logTrace, endTrace } from "./tracing";

export class SubstrateDO {
  state: DurableObjectState;
  env: ReturnType<typeof getEnv>;

  constructor(state: DurableObjectState, rawEnv: any) {
    this.state = state;
    this.env = getEnv(rawEnv);
  }

  async fetch(request: Request) {
    const ctx: any = {};
    startTrace(ctx, "SubstrateDO.fetch");

    try {
      const snapshot = await this.state.storage.get("snapshot");
      logTrace(ctx, "substrate_read", { snapshot });

      return new Response(JSON.stringify(snapshot ?? {}), {
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      endTrace(ctx);
    }
  }
}
