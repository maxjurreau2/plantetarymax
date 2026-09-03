from fastapi import FastAPI, Request
import time
import uuid
import redis.asyncio as redis
from prometheus_client import Counter, Gauge, generate_latest

app = FastAPI()

# ---------------------------------------------------------
# Redis client
# ---------------------------------------------------------
r = redis.from_url("redis://localhost:6379/0")

# ---------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------
messages_enqueued = Counter("kernel_messages_enqueued_total", "Messages enqueued")
kernel_status_updates = Counter("kernel_status_updates_total", "Kernel status updates")
kernel_phase_gauge = Gauge("kernel_phase", "Kernel phase numeric")

# ---------------------------------------------------------
# 1. Kernel Status
# ---------------------------------------------------------

@app.get("/kernel/status")
async def kernel_status():
    status = {
        "phase": "ready",
        "updated_at": time.time(),
        "meta": {}
    }
    kernel_status_updates.inc()
    kernel_phase_gauge.set(1)
    return status

# ---------------------------------------------------------
# 2. Message Queue Enqueue (Redis-backed)
# ---------------------------------------------------------

@app.post("/queue/enqueue")
async def queue_enqueue(request: Request):
    envelope = await request.json()
    message_id = envelope.get("id") or str(uuid.uuid4())

    envelope["id"] = message_id
    envelope["ts"] = time.time()

    await r.lpush("kernel:queue", envelope)
    messages_enqueued.inc()

    return {
        "message_id": message_id,
        "status": "queued",
        "ts": envelope["ts"]
    }

# ---------------------------------------------------------
# 3. Identity Adapter
# ---------------------------------------------------------

@app.post("/identity/check")
async def identity_check(request: Request):
    body = await request.json()
    token = body.get("token")

    if not token or token == "dev-token":
        return {
            "id": "dev",
            "roles": ["admin"],
            "ts": time.time()
        }

    return {
        "id": "user",
        "roles": ["user"],
        "ts": time.time()
    }

# ---------------------------------------------------------
# 4. Governance Adapter
# ---------------------------------------------------------

@app.get("/governance/check")
async def governance_check(q: str = ""):
    return {
        "action": q,
        "allow": True,
        "reason": "dev-fallback",
        "ts": time.time()
    }

# ---------------------------------------------------------
# 5. Prometheus Metrics
# ---------------------------------------------------------

@app.get("/metrics")
async def metrics():
    return generate_latest()
