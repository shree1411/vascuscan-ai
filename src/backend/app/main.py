import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os

from app.core.config import settings
from app.api import patients, sensors, assessments

# ── Socket.IO Setup ─────────────────────────────────────────────────────────
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins="*")

# ── FastAPI Setup ───────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(patients.router, prefix=f"{settings.API_V1_STR}/patients", tags=["patients"])
app.include_router(sensors.router, prefix=f"{settings.API_V1_STR}/sensors", tags=["sensors"])
app.include_router(assessments.router, prefix=f"{settings.API_V1_STR}/assessments", tags=["assessments"])

# The ASGIApp should wrap the FastAPI app to handle /socket.io requests correctly
main_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Serve Frontend static files if dist exists
frontend_dir = os.path.join(settings.BASE_DIR, "src", "frontend", "dist")
if os.path.exists(frontend_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

    @app.get("/dashboard")
    @app.get("/")
    async def serve_dashboard():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

@app.on_event("startup")
async def startup_event():
    from app.services.websocket_service import WebsocketService
    import app.services.websocket_service as ws_mod
    from app.services.telemetry_service import TelemetryService
    import app.services.telemetry_service as tel_mod
    from app.core.database import init_db

    # 1. Init DB
    init_db()

    # 2. Init global services
    ws_mod.websocket_service = WebsocketService(sio)
    tel_mod.telemetry_service = TelemetryService(ws_mod.websocket_service)

    # 3. Start background telemetry
    tel_mod.telemetry_service.start()

@app.on_event("shutdown")
def shutdown_event():
    import app.services.telemetry_service as tel_mod
    if tel_mod.telemetry_service:
        tel_mod.telemetry_service.stop()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

if __name__ == "__main__":
    uvicorn.run("app.main:main_app", host="0.0.0.0", port=5005, reload=True)
