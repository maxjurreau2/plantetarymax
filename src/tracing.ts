export function startTrace(ctx: any, name: string) {
  const spanId = crypto.randomUUID();
  const ts = Date.now();

  const span = {
    spanId,
    traceId: ctx.correlationId ?? crypto.randomUUID(),
    name,
    start: ts,
    logs: [] as any[],
  };

  ctx.currentSpan = span;
  return span;
}

export function logTrace(ctx: any, message: string, data: any = {}) {
  if (!ctx.currentSpan) return;

  ctx.currentSpan.logs.push({
    ts: Date.now(),
    message,
    ...data,
  });
}

export function endTrace(ctx: any) {
  if (!ctx.currentSpan) return;

  const span = ctx.currentSpan;
  span.end = Date.now();
  span.durationMs = span.end - span.start;

  console.log(JSON.stringify({ event: "trace", ...span }));

  ctx.currentSpan = null;
}
