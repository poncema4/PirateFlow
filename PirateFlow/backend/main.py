import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

load_dotenv()

START_TIME = time.time()

# The built React frontend lives here after `npm run build` in frontend/
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB, enable WAL mode, etc.
    print("PirateFlow API starting up...")
    yield
    # Shutdown
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


# --- Health Check ---
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "project": "PirateFlow",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - START_TIME),
    }


# --- Serve React Frontend (production) ---
# Mount static assets if the build directory exists
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # Catch-all: serve index.html for any non-API route (React Router support)
    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        # If the file exists in dist/, serve it (favicon, icons, etc.)
        file_path = STATIC_DIR / path
        if file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for client-side routing
        return FileResponse(STATIC_DIR / "index.html")
