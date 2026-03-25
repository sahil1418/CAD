"""
Consensus Engine — Weighted scoring, verdict computation,
design score calculation, and dissent detection.
"""

from typing import Dict, Any, List


# ── Agent Weights ──────────────────────────────────────────────────
WEIGHT_MAP = {
    "structural": 0.30,
    "manufacturing": 0.25,
    "compliance": 0.20,
    "intent": 0.15,
    "cost": 0.10,
}

# ── Verdict Score Mapping ──────────────────────────────────────────
VERDICT_SCORE = {
    "PASS": 1.0,
    "WARN": 0.6,
    "FAIL": 0.2,
}


def compute_consensus(agent_outputs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute final consensus from all agent outputs.

    Uses explicit formulas:
    - Weighted confidence score for final verdict
    - Separate design score calculation
    - Dissent detection between agents
    - Priority issue aggregation

    Args:
        agent_outputs: List of dicts from each agent

    Returns:
        ConsensusResult dict
    """
    if not agent_outputs:
        return _empty_consensus()

    # ── Weighted Consensus Score ───────────────────────────────────
    # Formula: score = Σ(agent.confidence * weight_map[agent.name])
    weighted_score = 0.0
    total_weight = 0.0

    for output in agent_outputs:
        agent_name = output.get("agent", "")
        confidence = output.get("confidence", 0.5)
        weight = WEIGHT_MAP.get(agent_name, 0.1)

        # Factor in verdict: confidence alone doesn't capture FAIL vs PASS
        verdict = output.get("verdict", "WARN")
        verdict_factor = VERDICT_SCORE.get(verdict, 0.5)

        weighted_score += confidence * verdict_factor * weight
        total_weight += weight

    if total_weight > 0:
        normalized_score = weighted_score / total_weight
    else:
        normalized_score = 0.5

    # ── Final Verdict (explicit thresholds) ────────────────────────
    if normalized_score > 0.75:
        final_verdict = "PASS"
    elif normalized_score > 0.5:
        final_verdict = "CONDITIONAL_PASS"
    else:
        final_verdict = "FAIL"

    # ── Design Score (0-100) ───────────────────────────────────────
    # Separate formula: weighted sum of individual confidence * verdict scores
    conf_map = {}
    for output in agent_outputs:
        name = output.get("agent", "")
        conf = output.get("confidence", 0.5)
        verdict = output.get("verdict", "WARN")
        conf_map[name] = conf * VERDICT_SCORE.get(verdict, 0.5)

    design_score = int(100 * (
        0.30 * conf_map.get("structural", 0.5) +
        0.25 * conf_map.get("manufacturing", 0.5) +
        0.20 * conf_map.get("compliance", 0.5) +
        0.15 * conf_map.get("intent", 0.5) +
        0.10 * conf_map.get("cost", 0.5)
    ))
    design_score = max(0, min(100, design_score))

    # ── Priority Issues ────────────────────────────────────────────
    all_issues = []
    for output in agent_outputs:
        for issue in output.get("issues", []):
            issue_copy = dict(issue)
            issue_copy["source_agent"] = output.get("agent", "unknown")
            all_issues.append(issue_copy)

    # Sort by severity: HIGH first, then MEDIUM, then LOW
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    priority_issues = sorted(all_issues, key=lambda x: severity_order.get(x.get("severity", "LOW"), 3))

    # ── Dissent Detection ──────────────────────────────────────────
    dissent_detected, dissent_details = _detect_dissent(agent_outputs)

    # ── Agent Summary ──────────────────────────────────────────────
    agent_summary = []
    for output in agent_outputs:
        agent_summary.append({
            "agent": output.get("agent", ""),
            "verdict": output.get("verdict", ""),
            "confidence": output.get("confidence", 0),
            "issues": output.get("issues", []),
            "reasoning": output.get("reasoning", ""),
        })
        # Include cost breakdown if present
        if "cost_breakdown" in output:
            agent_summary[-1]["cost_breakdown"] = output["cost_breakdown"]

    # ── Uncertainty ─────────────────────────────────────────────────
    uncertainty = round(1.0 - normalized_score, 3)
    low_confidence_flag = uncertainty > 0.4 or dissent_detected

    # ── Top 3 Issues ──────────────────────────────────────────────
    top_3_issues = priority_issues[:3]

    # ── Dissent Summary ───────────────────────────────────────────
    dissent_summary = ""
    if dissent_detected:
        verdicts = {o.get("agent", ""): o.get("verdict", "") for o in agent_outputs}
        parts = [f"{a}: {v}" for a, v in verdicts.items()]
        dissent_summary = f"Agent verdicts — {', '.join(parts)}. {' '.join(dissent_details[:2])}"

    return {
        "final_verdict": final_verdict,
        "confidence": round(normalized_score, 3),
        "uncertainty": uncertainty,
        "design_score": design_score,
        "low_confidence_flag": low_confidence_flag,
        "priority_issues": priority_issues,
        "top_3_issues": top_3_issues,
        "agent_summary": agent_summary,
        "dissent_detected": dissent_detected,
        "dissent_details": dissent_details,
        "dissent_summary": dissent_summary,
    }


def _detect_dissent(agent_outputs: List[Dict[str, Any]]) -> tuple:
    """
    Detect when agents significantly disagree.
    Dissent = one agent says PASS while another says FAIL.
    """
    dissent_detected = False
    dissent_details = []

    verdicts = {o.get("agent", ""): o.get("verdict", "") for o in agent_outputs}

    passing_agents = [a for a, v in verdicts.items() if v == "PASS"]
    failing_agents = [a for a, v in verdicts.items() if v == "FAIL"]

    if passing_agents and failing_agents:
        dissent_detected = True
        dissent_details.append(
            f"PASS/FAIL conflict: {', '.join(passing_agents)} report PASS while "
            f"{', '.join(failing_agents)} report FAIL."
        )

    # Check for confidence disagreement (one high, one very low)
    confidences = [(o.get("agent", ""), o.get("confidence", 0.5)) for o in agent_outputs]
    for i in range(len(confidences)):
        for j in range(i + 1, len(confidences)):
            a1, c1 = confidences[i]
            a2, c2 = confidences[j]
            if abs(c1 - c2) > 0.5:
                dissent_detected = True
                dissent_details.append(
                    f"Confidence gap: {a1} ({c1:.0%}) vs {a2} ({c2:.0%}) — "
                    f"large disagreement in analysis certainty."
                )

    return dissent_detected, dissent_details


def _empty_consensus() -> Dict[str, Any]:
    return {
        "final_verdict": "FAIL",
        "confidence": 0.0,
        "uncertainty": 1.0,
        "design_score": 0,
        "low_confidence_flag": True,
        "priority_issues": [],
        "top_3_issues": [],
        "agent_summary": [],
        "dissent_detected": False,
        "dissent_details": [],
        "dissent_summary": "",
    }
