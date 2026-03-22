import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from middleware.errors import install_error_handlers
from middleware.logging_webhook import install_webhook_logging, send_discord, COLOR_GREEN, COLOR_RED
from routers import auth, buildings, rooms, bookings, analytics, ai, websocket, demo, face_access, users, cameras

load_dotenv()

START_TIME = time.time()

STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.database import init_db, close_db
    from services.seed import seed_database

    print("PirateFlow API starting up...")
    await init_db()
    await seed_database()

    # Load enrolled faces from DB for face recognition
    try:
        from services.face_service import load_enrolled_faces
        await load_enrolled_faces()
    except Exception as e:
        print(f"Face loading skipped: {e}")

    # Notify Discord on startup
    await send_discord(
        title="🚀 PirateFlow Server Started",
        description="Backend is online and ready.",
        color=COLOR_GREEN,
        fields=[
            {"name": "Repo", "value": f"`poncema4/PirateFlow`", "inline": True},
            {"name": "Time", "value": f"`{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}`", "inline": True},
        ],
    )

    yield

    # Notify Discord on shutdown
    await send_discord(
        title="🔴 PirateFlow Server Stopped",
        description="Backend has shut down.",
        color=COLOR_RED,
        fields=[
            {"name": "Time", "value": f"`{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}`", "inline": True},
        ],
    )
    await close_db()
    print("PirateFlow API shutting down...")


app = FastAPI(
    title="PirateFlow API",
    description="Campus Space Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Error Handlers ---
install_error_handlers(app)

# --- Webhook Logging Middleware ---
install_webhook_logging(app)

# --- Register Routers ---
app.include_router(auth.router)
app.include_router(buildings.router)
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(websocket.router)
app.include_router(demo.router)
app.include_router(face_access.router)
app.include_router(users.router)
app.include_router(cameras.router)


# --- Health Check ---
@app.get("/api/health")
async def health_check():
    from routers.websocket import manager
    return {
        "status": "healthy",
        "project": "PirateFlow",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - START_TIME),
        "ws_connections": manager.active_count,
    }


# --- Serve React Frontend (production) ---
if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        file_path = (STATIC_DIR / path).resolve()
        if not str(file_path).startswith(str(STATIC_DIR.resolve())):
            return FileResponse(STATIC_DIR / "index.html")
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")