"""
Cost Agent — Estimates manufacturing cost based on geometric complexity,
surface area, volume, machining difficulty, and material usage.
"""

from typing import Dict, Any, List
from agents.base_agent import BaseAgent


class CostAgent(BaseAgent):
    agent_name = "cost"

    # Cost model parameters
    MATERIAL_COST_PER_CM3 = 0.15         # $/cm³ (aluminum)
    MACHINING_COST_PER_HOUR = 75.0       # $/hr
    SETUP_COST = 50.0                     # $ per job
    FINISHING_COST_PER_CM2 = 0.05         # $/cm²

    # Complexity → machining time multipliers
    COMPLEXITY_TIME_MAP = {
        (0.0, 0.2): 0.5,   # trivial
        (0.2, 0.4): 1.0,   # simple
        (0.4, 0.6): 1.8,   # moderate
        (0.6, 0.8): 3.0,   # complex
        (0.8, 1.0): 5.0,   # very complex
    }

    # Cost thresholds for verdicts
    HIGH_COST_THRESHOLD = 500.0    # $
    WARN_COST_THRESHOLD = 200.0    # $

    def _analyze(self, design_data: Dict[str, Any], shared_context: Dict[str, Any]) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        confidence = 0.85

        volume = design_data.get("volume", 0)
        surface_area = design_data.get("surface_area", 0)
        complexity = design_data.get("complexity_score", 0)
        num_faces = design_data.get("num_faces", 0)
        has_cavities = design_data.get("has_internal_cavities", False)
        sharp_edges = design_data.get("sharp_edge_count", 0)
        min_thickness = design_data.get("min_thickness", 0)

        # ── Material cost ──────────────────────────────────────────
        volume_cm3 = volume / 1000.0  # mm³ → cm³
        material_cost = volume_cm3 * self.MATERIAL_COST_PER_CM3

        # ── Machining time estimate ────────────────────────────────
        base_time_hours = self._estimate_machining_time(num_faces, complexity)
        machining_cost = base_time_hours * self.MACHINING_COST_PER_HOUR

        # ── Surface finishing cost ─────────────────────────────────
        surface_cm2 = surface_area / 100.0  # mm² → cm²
        finishing_cost = surface_cm2 * self.FINISHING_COST_PER_CM2

        # ── Complexity surcharge ───────────────────────────────────
        if has_cavities:
            machining_cost *= 1.5  # 50% surcharge for internal cavities
            issues.append({
                "type": "cavity_surcharge",
                "severity": "LOW",
                "location": "internal geometry",
                "message": "Internal cavities add 50% machining surcharge due to multi-setup requirement.",
                "suggestion": "Simplify internal geometry or consider additive manufacturing.",
            })

        if sharp_edges > 15:
            machining_cost *= 1.2  # 20% for deburring
            issues.append({
                "type": "deburring_cost",
                "severity": "LOW",
                "location": "edge features",
                "message": f"{sharp_edges} sharp edges require additional deburring (+20% machining cost).",
                "suggestion": "Add chamfers or fillets to reduce post-processing cost.",
            })

        if min_thickness > 0 and min_thickness < 1.0:
            machining_cost *= 1.3  # precision premium
            issues.append({
                "type": "precision_premium",
                "severity": "MEDIUM",
                "location": "thin features",
                "message": f"Thin features ({min_thickness:.2f}mm) require precision machining (+30% cost).",
                "suggestion": "Increase minimum feature size to reduce machining precision requirements.",
            })
            confidence -= 0.05

        # ── Total cost ─────────────────────────────────────────────
        total_cost = self.SETUP_COST + material_cost + machining_cost + finishing_cost

        # ── Difficulty score ───────────────────────────────────────
        difficulty = self._compute_difficulty(complexity, has_cavities, sharp_edges, min_thickness)

        # ── Cost breakdown ─────────────────────────────────────────
        cost_breakdown = {
            "setup": round(self.SETUP_COST, 2),
            "material": round(material_cost, 2),
            "machining": round(machining_cost, 2),
            "finishing": round(finishing_cost, 2),
            "total": round(total_cost, 2),
            "difficulty_score": round(difficulty, 2),
            "estimated_hours": round(base_time_hours, 2),
        }

        # ── Cost verdict ───────────────────────────────────────────
        if total_cost > self.HIGH_COST_THRESHOLD:
            issues.append({
                "type": "high_cost",
                "severity": "HIGH",
                "location": "global",
                "message": f"Estimated cost ${total_cost:.2f} exceeds high threshold (${self.HIGH_COST_THRESHOLD}).",
                "suggestion": "Simplify geometry, reduce material volume, or consider alternative manufacturing.",
            })
            confidence -= 0.1
        elif total_cost > self.WARN_COST_THRESHOLD:
            issues.append({
                "type": "moderate_cost",
                "severity": "MEDIUM",
                "location": "global",
                "message": f"Estimated cost ${total_cost:.2f} is above moderate threshold (${self.WARN_COST_THRESHOLD}).",
                "suggestion": "Review cost drivers — machining time and material volume are the primary factors.",
            })

        # ── Cross-reference manufacturing issues ───────────────────
        previous = shared_context.get("previous_results", [])
        for prev in previous:
            if prev.get("agent") == "manufacturing" and prev.get("verdict") == "FAIL":
                issues.append({
                    "type": "manufacturing_cost_risk",
                    "severity": "MEDIUM",
                    "location": "cross-agent",
                    "message": "Manufacturing agent flagged FAIL — actual cost likely higher than estimated.",
                    "suggestion": "Resolve manufacturing issues first; cost estimate may change significantly.",
                })
                confidence -= 0.08

        # ── Verdict ────────────────────────────────────────────────
        confidence = max(0.1, confidence)
        high_issues = sum(1 for i in issues if i["severity"] == "HIGH")
        med_issues = sum(1 for i in issues if i["severity"] == "MEDIUM")

        if high_issues > 0:
            verdict = "FAIL"
        elif med_issues >= 2:
            verdict = "WARN"
        elif med_issues == 1:
            verdict = "WARN"
        else:
            verdict = "PASS"

        return {
            "agent": self.agent_name,
            "verdict": verdict,
            "confidence": round(confidence, 3),
            "issues": issues,
            "reasoning": self._build_reasoning(cost_breakdown, difficulty, issues),
            "cost_breakdown": cost_breakdown,
        }

    def _estimate_machining_time(self, num_faces: int, complexity: float) -> float:
        """Estimate machining time in hours based on geometry complexity."""
        base_time = max(0.1, num_faces / 200.0)  # rough: 200 faces per hour

        multiplier = 1.0
        for (lo, hi), mult in self.COMPLEXITY_TIME_MAP.items():
            if lo <= complexity < hi:
                multiplier = mult
                break

        return base_time * multiplier

    def _compute_difficulty(self, complexity, cavities, sharp_edges, min_thickness) -> float:
        """Machining difficulty score 0-10."""
        score = complexity * 5.0
        if cavities:
            score += 2.0
        if sharp_edges > 10:
            score += 1.5
        if min_thickness > 0 and min_thickness < 1.0:
            score += 1.5
        return min(10.0, score)

    def _build_reasoning(self, breakdown, difficulty, issues) -> str:
        parts = [
            f"Cost estimation complete. Total: ${breakdown['total']:.2f}.",
            f"Breakdown — Setup: ${breakdown['setup']}, Material: ${breakdown['material']:.2f}, "
            f"Machining: ${breakdown['machining']:.2f} ({breakdown['estimated_hours']:.1f}hrs), "
            f"Finishing: ${breakdown['finishing']:.2f}.",
            f"Machining difficulty: {difficulty:.1f}/10.",
        ]
        if issues:
            parts.append(f"{len(issues)} cost-related issue(s) flagged.")
        return " ".join(parts)
