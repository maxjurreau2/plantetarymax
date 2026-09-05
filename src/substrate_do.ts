export class SubstrateDO {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const snapshot = await this.state.storage.get("snapshot");
    return new Response(JSON.stringify(snapshot || {}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
