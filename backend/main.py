"""
FastAPI application entry point for the CAD Validation System.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.analysis import router as analysis_router
from routes.websocket import router as ws_router

app = FastAPI(
    title="Multi-Agent CAD Validation System",
    description="Validates CAD designs using 5 specialized AI agents with consensus engine",
    version="1.0.0",
)

# ── CORS ───────────────────────────────────────────────────────────
# CORS — allow env-configured frontend domain plus localhost for dev
allowed_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────
app.include_router(analysis_router, prefix="/api")
app.include_router(ws_router, prefix="/api")

# ── Upload directory ───────────────────────────────────────────────
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def root():
    return {
        "system": "Multi-Agent CAD Validation System",
        "version": "1.0.0",
        "agents": ["structural", "manufacturing", "compliance", "intent", "cost"],
        "endpoints": ["/api/upload", "/api/analyze", "/api/results/{session_id}"],
    }
