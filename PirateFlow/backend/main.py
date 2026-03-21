import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from middleware.errors import install_error_handlers
from routers import auth, buildings, rooms, bookings, analytics, ai, websocket, demo

load_dotenv()

START_TIME = time.time()

# The built React frontend lives here after `npm run build` in frontend/
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB, seed data
    from services.database import init_db, close_db
    from services.seed import seed_database

    print("PirateFlow API starting up...")
    await init_db()
    await seed_database()
    yield
    # Shutdown
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

# --- Register Routers ---
app.include_router(auth.router)
app.include_router(buildings.router)
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(websocket.router)
app.include_router(demo.router)


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
# Mount static assets if the build directory exists
if STATIC_DIR.exists():
    # Vite outputs hashed assets to dist/assets/ — serve with long cache
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Catch-all: serve static files or index.html for client-side routing."""
        # Prevent path traversal — resolve and verify it stays inside STATIC_DIR
        file_path = (STATIC_DIR / path).resolve()
        if not str(file_path).startswith(str(STATIC_DIR.resolve())):
            return FileResponse(STATIC_DIR / "index.html")

        if file_path.is_file():
            return FileResponse(file_path)

        # All non-file routes serve index.html (React Router handles them)
        return FileResponse(STATIC_DIR / "index.html")
