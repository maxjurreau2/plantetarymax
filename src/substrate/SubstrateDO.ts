export class SubstrateDO {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    return new Response(JSON.stringify({
      ok: true,
      ts: Date.now() / 1000,
      note: "SubstrateDO alive"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
