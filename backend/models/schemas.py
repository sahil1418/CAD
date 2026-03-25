"""
Pydantic models and schemas for the CAD Validation System.
Includes standardized Issue schema that ALL agents must use.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────

class Verdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"
    CONDITIONAL_PASS = "CONDITIONAL_PASS"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# ── Standardized Issue Schema ──────────────────────────────────────

class Issue(BaseModel):
    """Every agent MUST use this exact schema for reported issues."""
    type: str = Field(..., description="Issue type, e.g. 'thin_wall', 'undercut', 'tolerance_violation'")
    severity: Severity = Field(..., description="LOW / MEDIUM / HIGH")
    location: str = Field(default="global", description="Affected region or feature")
    message: str = Field(..., description="Human-readable description of the issue")
    suggestion: str = Field(default="", description="Recommended fix or mitigation")


# ── Agent Output ───────────────────────────────────────────────────

class AgentOutput(BaseModel):
    agent: str
    verdict: Verdict
    confidence: float = Field(..., ge=0.0, le=1.0)
    issues: List[Issue] = []
    reasoning: str = ""


# ── Normalized Design Data ─────────────────────────────────────────

class NormalizedDesignData(BaseModel):
    num_faces: int = 0
    num_edges: int = 0
    num_vertices: int = 0
    bounding_box: dict = Field(default_factory=lambda: {"x": 0, "y": 0, "z": 0})
    dimensions: dict = Field(default_factory=lambda: {"length": 0, "width": 0, "height": 0})
    avg_thickness: float = 0.0
    min_thickness: float = 0.0
    surface_area: float = 0.0
    volume: float = 0.0
    complexity_score: float = 0.0
    aspect_ratios: List[float] = []
    face_normals: List[List[float]] = []
    has_internal_cavities: bool = False
    sharp_edge_count: int = 0
    max_depth: float = 0.0


# ── Consensus Result ───────────────────────────────────────────────

class ConsensusResult(BaseModel):
    final_verdict: str
    confidence: float
    design_score: int = Field(..., ge=0, le=100)
    priority_issues: List[Issue] = []
    agent_summary: List[AgentOutput] = []
    dissent_detected: bool = False
    dissent_details: List[str] = []


# ── API Request / Response ─────────────────────────────────────────

class AnalysisRequest(BaseModel):
    session_id: str
    design_brief: str = ""


class AnalysisResponse(BaseModel):
    session_id: str
    final_verdict: str
    score: int
    issues: List[Issue] = []
    agents: List[AgentOutput] = []
    dissent_detected: bool = False
    dissent_details: List[str] = []


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    message: str
    geometry_summary: dict = {}
