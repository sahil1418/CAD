"""
API Routes for the CAD Validation System.
POST /upload — accepts CAD file, parses it
POST /analyze — runs full agent pipeline, returns consensus
GET /results/{session_id} — retrieves stored results
"""

import os
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from services.cad_parser import parse_cad_file
from services.feature_extractor import normalize_design_data
from services.shared_memory import shared_memory
from services.orchestrator import run_pipeline
from services.consensus import compute_consensus

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_cad_file(file: UploadFile = File(...), design_brief: str = Form(default="")):
    """
    Upload a CAD file (STEP/OBJ) and parse it.
    Returns session_id and geometry summary.
    """
    # Validate file extension
    allowed_extensions = {".obj", ".stp", ".step", ".stl"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(allowed_extensions)}"
        )

    # Generate session ID
    session_id = str(uuid.uuid4())

    # Save file
    filepath = os.path.join(UPLOAD_DIR, f"{session_id}{ext}")
    try:
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Parse CAD file
    try:
        raw_geometry = parse_cad_file(filepath)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CAD file: {str(e)}")

    # Normalize design data
    try:
        normalized = normalize_design_data(raw_geometry)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to normalize design data: {str(e)}")

    # Initialize shared memory session
    context = shared_memory.create_session(session_id, geometry=raw_geometry, design_brief=design_brief)
    shared_memory.update_context(session_id, "normalized_data", normalized)
    shared_memory.update_context(session_id, "file_path", filepath)
    shared_memory.update_context(session_id, "status", "uploaded")

    return {
        "session_id": session_id,
        "filename": file.filename,
        "message": "File uploaded and parsed successfully",
        "geometry_summary": {
            "format": raw_geometry.get("format", "unknown"),
            "num_vertices": normalized.get("num_vertices", 0),
            "num_faces": normalized.get("num_faces", 0),
            "bounding_box": normalized.get("bounding_box", {}),
            "complexity_score": normalized.get("complexity_score", 0),
        },
    }


@router.post("/analyze")
async def analyze_design(session_id: str, design_brief: Optional[str] = None):
    """
    Run the full agent pipeline on an uploaded design.
    Optionally update the design brief before analysis.
    """
    if not shared_memory.session_exists(session_id):
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found. Upload a file first.")

    context = shared_memory.get_context(session_id)

    # Update design brief if provided
    if design_brief is not None:
        shared_memory.update_context(session_id, "design_brief", design_brief)

    # Get normalized data
    normalized = context.get("normalized_data", {})
    if not normalized:
        raise HTTPException(status_code=422, detail="No normalized design data found. Re-upload the file.")

    shared_memory.update_context(session_id, "status", "analyzing")

    # Run agent pipeline
    try:
        agent_outputs = run_pipeline(session_id, normalized)
    except Exception as e:
        shared_memory.update_context(session_id, "status", "error")
        raise HTTPException(status_code=500, detail=f"Agent pipeline failed: {str(e)}")

    # Compute consensus
    try:
        consensus = compute_consensus(agent_outputs)
    except Exception as e:
        shared_memory.update_context(session_id, "status", "error")
        raise HTTPException(status_code=500, detail=f"Consensus computation failed: {str(e)}")

    # Store consensus result
    shared_memory.set_consensus(session_id, consensus)

    return {
        "session_id": session_id,
        "final_verdict": consensus["final_verdict"],
        "score": consensus["design_score"],
        "confidence": consensus["confidence"],
        "uncertainty": consensus.get("uncertainty", 0),
        "low_confidence_flag": consensus.get("low_confidence_flag", False),
        "issues": consensus["priority_issues"],
        "top_3_issues": consensus.get("top_3_issues", []),
        "agents": consensus["agent_summary"],
        "dissent_detected": consensus["dissent_detected"],
        "dissent_details": consensus["dissent_details"],
        "dissent_summary": consensus.get("dissent_summary", ""),
    }


@router.get("/results/{session_id}")
async def get_results(session_id: str):
    """Retrieve stored analysis results for a session."""
    if not shared_memory.session_exists(session_id):
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    context = shared_memory.get_context(session_id)
    consensus = context.get("consensus")

    if consensus is None:
        return {
            "session_id": session_id,
            "status": context.get("status", "unknown"),
            "message": "Analysis not yet completed. Call POST /api/analyze first.",
        }

    return {
        "session_id": session_id,
        "status": "completed",
        "final_verdict": consensus["final_verdict"],
        "score": consensus["design_score"],
        "confidence": consensus["confidence"],
        "uncertainty": consensus.get("uncertainty", 0),
        "low_confidence_flag": consensus.get("low_confidence_flag", False),
        "issues": consensus["priority_issues"],
        "top_3_issues": consensus.get("top_3_issues", []),
        "agents": consensus["agent_summary"],
        "dissent_detected": consensus["dissent_detected"],
        "dissent_details": consensus["dissent_details"],
        "dissent_summary": consensus.get("dissent_summary", ""),
    }
