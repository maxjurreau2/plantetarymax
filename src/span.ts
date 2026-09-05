/**
 * Start a new span.
 * - Assigns spanId
 * - Inherits traceId or creates a new one
 * - Sets parentSpanId if a span is already active
 * - Records start time
 * - Initializes log array
 */
export function startSpan(ctx: any, name: string) {
  const span = {
    spanId: crypto.randomUUID(),
    traceId: ctx.traceId ?? crypto.randomUUID(),
    parentSpanId: ctx.currentSpan?.spanId ?? null,
    name,
    start: Date.now(),
    logs: [] as any[],
  };

  ctx.currentSpan = span;
  return span;
}

/**
 * Append a structured log entry to the active span.
 */
export function logSpan(ctx: any, message: string, data: any = {}) {
  if (!ctx.currentSpan) return;

  ctx.currentSpan.logs.push({
    ts: Date.now(),
    message,
    ...data,
  });
}

/**
 * Finalize the active span.
 * - Computes end time and duration
 * - Emits a structured JSON log
 * - Clears ctx.currentSpan
 */
export function endSpan(ctx: any) {
  if (!ctx.currentSpan) return;

  const span = ctx.currentSpan;
  span.end = Date.now();
  span.durationMs = span.end - span.start;

  console.log(JSON.stringify({ event: "span", ...span }));

  ctx.currentSpan = null;
}
