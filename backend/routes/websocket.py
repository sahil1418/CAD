"""
WebSocket endpoint for real-time agent streaming.
Streams each agent's result as it completes, then sends consensus.
"""

import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional

from agents.structural_agent import StructuralAgent
from agents.manufacturing_agent import ManufacturingAgent
from agents.compliance_agent import ComplianceAgent
from agents.intent_agent import IntentAgent
from agents.cost_agent import CostAgent
from services.shared_memory import shared_memory
from services.consensus import compute_consensus

router = APIRouter()

AGENT_PIPELINE = [
    StructuralAgent(),
    ManufacturingAgent(),
    ComplianceAgent(),
    IntentAgent(),
    CostAgent(),
]


@router.websocket("/ws/analyze/{session_id}")
async def websocket_analyze(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time analysis streaming.
    Streams agent results one-by-one, then sends final consensus.

    Message types sent:
      {"type": "agent_start", "agent": "structural", "index": 0, "total": 5}
      {"type": "agent_result", "agent": "structural", "data": {...}}
      {"type": "consensus", "data": {...}}
      {"type": "error", "message": "..."}
      {"type": "complete"}
    """
    await websocket.accept()

    try:
        # Check session exists
        if not shared_memory.session_exists(session_id):
            await websocket.send_json({"type": "error", "message": f"Session '{session_id}' not found."})
            await websocket.close()
            return

        context = shared_memory.get_context(session_id)
        normalized = context.get("normalized_data", {})

        if not normalized:
            await websocket.send_json({"type": "error", "message": "No design data found. Upload a file first."})
            await websocket.close()
            return

        # Optionally receive design brief update
        try:
            msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.5)
            data = json.loads(msg)
            if "design_brief" in data:
                shared_memory.update_context(session_id, "design_brief", data["design_brief"])
        except (asyncio.TimeoutError, json.JSONDecodeError):
            pass

        shared_memory.update_context(session_id, "status", "analyzing")
        total = len(AGENT_PIPELINE)
        results = []

        # Stream agent results one by one
        for idx, agent in enumerate(AGENT_PIPELINE):
            # Notify: agent starting
            await websocket.send_json({
                "type": "agent_start",
                "agent": agent.agent_name,
                "index": idx,
                "total": total,
            })

            # Small delay for visual effect + to yield event loop
            await asyncio.sleep(0.3)

            # Get latest context (includes prior agent results)
            ctx = shared_memory.get_context(session_id)

            # Run agent (blocking but fast — no ML)
            result = agent.analyze(normalized, ctx)

            # Store in shared memory
            shared_memory.add_agent_result(session_id, agent.agent_name, result)
            results.append(result)

            # Send agent result
            await websocket.send_json({
                "type": "agent_result",
                "agent": agent.agent_name,
                "index": idx,
                "data": result,
            })

            # Brief pause between agents for streaming feel
            await asyncio.sleep(0.2)

        # Compute and send consensus
        consensus = compute_consensus(results)
        shared_memory.set_consensus(session_id, consensus)

        await websocket.send_json({
            "type": "consensus",
            "data": {
                "final_verdict": consensus["final_verdict"],
                "score": consensus["design_score"],
                "confidence": consensus["confidence"],
                "uncertainty": consensus.get("uncertainty", 0),
                "low_confidence_flag": consensus.get("low_confidence_flag", False),
                "score_breakdown": consensus.get("score_breakdown", {}),
                "worst_agent": consensus.get("worst_agent", ""),
                "verdict_explanation": consensus.get("verdict_explanation", ""),
                "recommended_fixes": consensus.get("recommended_fixes", []),
                "issues": consensus["priority_issues"],
                "top_3_issues": consensus.get("top_3_issues", []),
                "agents": consensus["agent_summary"],
                "dissent_detected": consensus["dissent_detected"],
                "dissent_details": consensus["dissent_details"],
                "dissent_summary": consensus.get("dissent_summary", ""),
            },
        })

        await websocket.send_json({"type": "complete"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
