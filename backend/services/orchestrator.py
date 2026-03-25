"""
Agent Orchestrator — Sequential pipeline execution.
Runs agents in order: structural → manufacturing → compliance → intent → cost.
Each agent can read results from prior agents via shared_context.
"""

from typing import Dict, Any, List
from agents.structural_agent import StructuralAgent
from agents.manufacturing_agent import ManufacturingAgent
from agents.compliance_agent import ComplianceAgent
from agents.intent_agent import IntentAgent
from agents.cost_agent import CostAgent
from services.shared_memory import shared_memory


# Agent execution order — critical for cross-agent referencing
AGENT_PIPELINE = [
    StructuralAgent(),
    ManufacturingAgent(),
    ComplianceAgent(),
    IntentAgent(),
    CostAgent(),
]


def run_pipeline(session_id: str, normalized_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Execute the full agent pipeline sequentially.

    Each agent:
    1. Reads normalized_data (same for all agents)
    2. Reads shared_context (includes previous_results from prior agents)
    3. Writes its result back to shared_context

    Args:
        session_id: Session ID for shared memory lookup
        normalized_data: Normalized design data from feature_extractor

    Returns:
        List of all agent output dicts
    """
    results = []

    for agent in AGENT_PIPELINE:
        # Get latest shared context (includes results from previous agents)
        context = shared_memory.get_context(session_id)

        # Run agent analysis (error handling is in BaseAgent)
        result = agent.analyze(normalized_data, context)

        # Store result in shared memory for downstream agents
        shared_memory.add_agent_result(session_id, agent.agent_name, result)

        results.append(result)

    return results
