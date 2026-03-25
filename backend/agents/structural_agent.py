"""
Structural Agent — Detects thin walls, weak regions, and stress concentration points.
"""

from typing import Dict, Any, List
from agents.base_agent import BaseAgent


class StructuralAgent(BaseAgent):
    agent_name = "structural"

    # Configurable thresholds
    THIN_WALL_THRESHOLD = 2.0        # mm
    CRITICAL_THIN_WALL = 0.5         # mm
    HIGH_ASPECT_RATIO = 8.0          # length/width warning
    STRESS_SHARP_EDGE_LIMIT = 10     # count
    COMPLEXITY_WARN = 0.7

    def _analyze(self, design_data: Dict[str, Any], shared_context: Dict[str, Any]) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        confidence = 0.9
        rules = shared_context.get("rules", {})

        min_wall = rules.get("min_wall_thickness", self.THIN_WALL_THRESHOLD)
        avg_thickness = design_data.get("avg_thickness", 0)
        min_thickness = design_data.get("min_thickness", 0)
        sharp_edges = design_data.get("sharp_edge_count", 0)
        aspect_ratios = design_data.get("aspect_ratios", [])
        complexity = design_data.get("complexity_score", 0)
        has_cavities = design_data.get("has_internal_cavities", False)
        volume = design_data.get("volume", 0)
        surface_area = design_data.get("surface_area", 0)

        # ── Thin wall detection ────────────────────────────────────
        if min_thickness > 0 and min_thickness < self.CRITICAL_THIN_WALL:
            issues.append({
                "type": "thin_wall_critical",
                "severity": "HIGH",
                "location": "minimum thickness region",
                "message": f"Critical thin wall detected: {min_thickness:.2f}mm (minimum safe: {min_wall}mm)",
                "suggestion": "Increase wall thickness to at least 1.0mm or add ribs for reinforcement.",
            })
            confidence -= 0.15
        elif min_thickness > 0 and min_thickness < min_wall:
            issues.append({
                "type": "thin_wall",
                "severity": "MEDIUM",
                "location": "minimum thickness region",
                "message": f"Thin wall detected: {min_thickness:.2f}mm (recommended: ≥{min_wall}mm)",
                "suggestion": "Consider increasing wall thickness or adding structural support.",
            })
            confidence -= 0.1

        # ── Weak region heuristic (high aspect ratio) ──────────────
        for i, ar in enumerate(aspect_ratios):
            if ar > self.HIGH_ASPECT_RATIO:
                issues.append({
                    "type": "high_aspect_ratio",
                    "severity": "MEDIUM",
                    "location": f"dimension pair {i+1}",
                    "message": f"High aspect ratio detected: {ar:.1f}:1 — indicates long, thin geometry prone to bending.",
                    "suggestion": "Add ribs or gussets to improve rigidity.",
                })
                confidence -= 0.05

        # ── Stress concentration (sharp edges) ─────────────────────
        if sharp_edges > self.STRESS_SHARP_EDGE_LIMIT:
            issues.append({
                "type": "stress_concentration",
                "severity": "MEDIUM",
                "location": "sharp edge regions",
                "message": f"{sharp_edges} sharp edges detected — potential stress concentration points.",
                "suggestion": "Add fillets (radius ≥ 0.5mm) to sharp edges to reduce stress.",
            })
            confidence -= 0.05

        # ── Internal cavity structural risk ────────────────────────
        if has_cavities:
            issues.append({
                "type": "internal_cavity",
                "severity": "LOW",
                "location": "internal geometry",
                "message": "Internal cavities detected — may weaken overall structural integrity.",
                "suggestion": "Verify cavity walls have adequate thickness and add internal ribs if needed.",
            })

        # ── Volume-to-surface ratio check (hollowness) ─────────────
        if surface_area > 0 and volume > 0:
            vs_ratio = volume / surface_area
            if vs_ratio < 0.5:
                issues.append({
                    "type": "hollow_structure",
                    "severity": "LOW",
                    "location": "global",
                    "message": f"Low volume-to-surface ratio ({vs_ratio:.2f}) — design may be too hollow.",
                    "suggestion": "Consider adding internal support structures.",
                })

        # ── Complexity warning ─────────────────────────────────────
        if complexity > self.COMPLEXITY_WARN:
            issues.append({
                "type": "high_complexity",
                "severity": "LOW",
                "location": "global",
                "message": f"Geometric complexity score: {complexity:.2f} — structurally complex design.",
                "suggestion": "Simplify geometry where possible to improve structural predictability.",
            })

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
            "reasoning": self._build_reasoning(issues, avg_thickness, min_thickness, sharp_edges, complexity),
        }

    def _build_reasoning(self, issues, avg_t, min_t, sharp, complexity) -> str:
        parts = [f"Analyzed structural integrity. Avg thickness: {avg_t:.2f}mm, Min: {min_t:.2f}mm."]
        parts.append(f"Sharp edges: {sharp}, Complexity: {complexity:.2f}.")
        if issues:
            parts.append(f"Found {len(issues)} issue(s): {', '.join(i['type'] for i in issues)}.")
        else:
            parts.append("No structural issues detected.")
        return " ".join(parts)
