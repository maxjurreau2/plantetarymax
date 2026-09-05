import { getEnv } from "./env";

export class SubstrateDO {
  state: DurableObjectState;
  env: ReturnType<typeof getEnv>;

  constructor(state: DurableObjectState, rawEnv: any) {
    this.state = state;
    this.env = getEnv(rawEnv);
  }

  async fetch(request: Request) {
    const snapshot = await this.state.storage.get("snapshot");
    return new Response(JSON.stringify(snapshot ?? {}), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
