"""
Shared Memory System.
In-memory dict store keyed by session_id.
Agents read from and write to this shared context.
"""

import copy
from typing import Dict, Any
import threading


class SharedMemory:
    """Thread-safe in-memory shared context for agent pipeline."""

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create_session(self, session_id: str, geometry: dict = None, design_brief: str = "") -> dict:
        """Initialize a new session context."""
        with self._lock:
            self._store[session_id] = {
                "geometry": geometry or {},
                "normalized_data": {},
                "design_brief": design_brief,
                "rules": {
                    "min_wall_thickness": 1.0,       # mm
                    "max_aspect_ratio": 10.0,
                    "tolerance_standard": "ISO_2768",
                    "tolerance_class": "medium",
                    "min_tolerance": 0.1,             # mm
                    "max_tolerance": 0.5,             # mm
                    "max_dimension": 500.0,           # mm
                    "min_dimension": 1.0,             # mm
                },
                "previous_results": [],
                "agent_outputs": {},
                "consensus": None,
                "status": "initialized",
                "file_path": "",
            }
        return self._store[session_id]

    def get_context(self, session_id: str) -> Dict[str, Any]:
        """Get a deep copy of the full context for a session (thread-safe)."""
        with self._lock:
            return copy.deepcopy(self._store.get(session_id, {}))

    def update_context(self, session_id: str, key: str, value: Any):
        """Update a specific key in session context."""
        with self._lock:
            if session_id in self._store:
                self._store[session_id][key] = value

    def add_agent_result(self, session_id: str, agent_name: str, result: dict):
        """Store an agent's output and add to previous_results for downstream agents."""
        with self._lock:
            if session_id in self._store:
                self._store[session_id]["agent_outputs"][agent_name] = result
                self._store[session_id]["previous_results"].append(result)

    def get_all_agent_outputs(self, session_id: str) -> list:
        """Get all agent outputs for consensus computation."""
        with self._lock:
            if session_id in self._store:
                return list(self._store[session_id]["agent_outputs"].values())
            return []

    def session_exists(self, session_id: str) -> bool:
        with self._lock:
            return session_id in self._store

    def set_consensus(self, session_id: str, consensus: dict):
        with self._lock:
            if session_id in self._store:
                self._store[session_id]["consensus"] = consensus
                self._store[session_id]["status"] = "completed"

    def reset_for_reanalysis(self, session_id: str):
        """Clear previous agent results before re-running the pipeline."""
        with self._lock:
            if session_id in self._store:
                self._store[session_id]["previous_results"] = []
                self._store[session_id]["agent_outputs"] = {}
                self._store[session_id]["consensus"] = None
                self._store[session_id]["status"] = "re-analyzing"


# Singleton instance
shared_memory = SharedMemory()
