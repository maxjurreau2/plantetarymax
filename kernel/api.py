from fastapi import FastAPI, Request
import time
import uuid

app = FastAPI()

# ---------------------------------------------------------
# 1. Kernel Status
# ---------------------------------------------------------

@app.get("/kernel/status")
async def kernel_status():
    return {
        "phase": "ready",
        "updated_at": time.time(),
        "meta": {}
    }

# ---------------------------------------------------------
# 2. Message Queue Enqueue
# ---------------------------------------------------------

@app.post("/queue/enqueue")
async def queue_enqueue(request: Request):
    envelope = await request.json()

    # Generate stable message ID
    message_id = envelope.get("id") or str(uuid.uuid4())

    # Simulated queue processing (replace with your real queue)
    result = {
        "message_id": message_id,
        "status": "queued",
        "ts": time.time()
    }

    return result

# ---------------------------------------------------------
# 3. Identity Adapter
# ---------------------------------------------------------

@app.post("/identity/check")
async def identity_check(request: Request):
    body = await request.json()
    token = body.get("token")

    # Dev fallback
    if not token or token == "dev-token":
        return {
            "id": "dev",
            "roles": ["admin"],
            "ts": time.time()
        }

    # Replace with real identity logic
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
    # Dev fallback: allow everything
    return {
        "action": q,
        "allow": True,
        "reason": "dev-fallback",
        "ts": time.time()
    }
