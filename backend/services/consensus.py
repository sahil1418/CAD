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

    # ── Design Score (0-100) + Score Breakdown ──────────────────────
    conf_map = {}
    score_breakdown = {}
    for output in agent_outputs:
        name = output.get("agent", "")
        conf = output.get("confidence", 0.5)
        verdict = output.get("verdict", "WARN")
        agent_score = conf * VERDICT_SCORE.get(verdict, 0.5)
        conf_map[name] = agent_score
        weight = WEIGHT_MAP.get(name, 0.1)
        # Per-agent contribution out of 100
        score_breakdown[name] = round(100 * agent_score * weight, 1)

    design_score = int(sum(score_breakdown.values()))
    design_score = max(0, min(100, design_score))

    # ── Worst Agent ────────────────────────────────────────────────
    worst_agent = ""
    verdict_explanation = ""
    if score_breakdown:
        worst_agent = min(score_breakdown, key=score_breakdown.get)
        max_possible = round(WEIGHT_MAP.get(worst_agent, 0.1) * 100, 0)
        worst_val = score_breakdown[worst_agent]
        worst_verdict = next((o.get("verdict", "") for o in agent_outputs if o.get("agent") == worst_agent), "")
        if worst_verdict == "FAIL":
            verdict_explanation = f"Failure driven by {worst_agent} constraints (scored {worst_val}/{max_possible})"
        elif worst_verdict == "WARN":
            verdict_explanation = f"Score limited by {worst_agent} warnings (scored {worst_val}/{max_possible})"
        else:
            verdict_explanation = f"All agents performing well. Lowest: {worst_agent} ({worst_val}/{max_possible})"

    # ── Priority Issues + priority_score ───────────────────────────
    SEVERITY_SCORE = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
    all_issues = []
    for output in agent_outputs:
        agent_name = output.get("agent", "unknown")
        agent_weight = WEIGHT_MAP.get(agent_name, 0.1)
        for issue in output.get("issues", []):
            issue_copy = dict(issue)
            issue_copy["source_agent"] = agent_name
            sev = SEVERITY_SCORE.get(issue.get("severity", "LOW"), 1)
            issue_copy["priority_score"] = round(sev * agent_weight * 100, 1)
            all_issues.append(issue_copy)

    # Sort by priority_score descending
    priority_issues = sorted(all_issues, key=lambda x: x.get("priority_score", 0), reverse=True)

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

    # ── Recommended Fixes ─────────────────────────────────────────
    seen = set()
    recommended_fixes = []
    for issue in priority_issues:
        suggestion = issue.get("suggestion", "")
        if suggestion and suggestion not in seen:
            seen.add(suggestion)
            recommended_fixes.append(suggestion)
    recommended_fixes = recommended_fixes[:5]  # top 5

    return {
        "final_verdict": final_verdict,
        "confidence": round(normalized_score, 3),
        "uncertainty": uncertainty,
        "design_score": design_score,
        "score_breakdown": score_breakdown,
        "worst_agent": worst_agent,
        "verdict_explanation": verdict_explanation,
        "low_confidence_flag": low_confidence_flag,
        "priority_issues": priority_issues,
        "top_3_issues": top_3_issues,
        "recommended_fixes": recommended_fixes,
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
        "score_breakdown": {},
        "worst_agent": "",
        "verdict_explanation": "",
        "low_confidence_flag": True,
        "priority_issues": [],
        "top_3_issues": [],
        "recommended_fixes": [],
        "agent_summary": [],
        "dissent_detected": False,
        "dissent_details": [],
        "dissent_summary": "",
    }
