import { startSpan, logSpan, endSpan } from "./span";

async fetch(request) {
  const ctx: any = {};
  ctx.traceId = request.headers.get("x-trace-id") ?? crypto.randomUUID();

  startSpan(ctx, "BrokerDO.fetch");
  logSpan(ctx, "broker_request", { path: new URL(request.url).pathname });

  try {
    ...
  } finally {
    endSpan(ctx);
  }
}
