"""
Compliance Agent — Rule-based checks for tolerances, dimensions,
and standards conformance (ISO 2768 defaults).
"""

from typing import Dict, Any, List
from agents.base_agent import BaseAgent


class ComplianceAgent(BaseAgent):
    agent_name = "compliance"

    # ISO 2768 medium tolerance lookup (simplified)
    ISO_2768_MEDIUM = {
        (0.5, 3): 0.1,
        (3, 6): 0.1,
        (6, 30): 0.2,
        (30, 120): 0.3,
        (120, 400): 0.5,
        (400, 1000): 0.8,
    }

    def _analyze(self, design_data: Dict[str, Any], shared_context: Dict[str, Any]) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        confidence = 0.92
        rules = shared_context.get("rules", {})

        dims = design_data.get("dimensions", {})
        bbox = design_data.get("bounding_box", {})
        aspect_ratios = design_data.get("aspect_ratios", [])
        num_faces = design_data.get("num_faces", 0)
        volume = design_data.get("volume", 0)
        surface_area = design_data.get("surface_area", 0)
        min_thickness = design_data.get("min_thickness", 0)

        max_dim_limit = rules.get("max_dimension", 500)
        min_dim_limit = rules.get("min_dimension", 1.0)
        min_tol = rules.get("min_tolerance", 0.1)
        max_tol = rules.get("max_tolerance", 0.5)

        length = dims.get("length", 0)
        width = dims.get("width", 0)
        height = dims.get("height", 0)

        # ── Dimension range checks ─────────────────────────────────
        for dim_name, dim_val in [("length", length), ("width", width), ("height", height)]:
            if dim_val > max_dim_limit:
                issues.append({
                    "type": "dimension_exceeded",
                    "severity": "HIGH",
                    "location": dim_name,
                    "message": f"{dim_name.capitalize()} = {dim_val:.1f}mm exceeds maximum allowed ({max_dim_limit}mm).",
                    "suggestion": f"Reduce {dim_name} to within {max_dim_limit}mm or request special approval.",
                })
                confidence -= 0.1

            if 0 < dim_val < min_dim_limit:
                issues.append({
                    "type": "dimension_too_small",
                    "severity": "MEDIUM",
                    "location": dim_name,
                    "message": f"{dim_name.capitalize()} = {dim_val:.2f}mm is below minimum ({min_dim_limit}mm).",
                    "suggestion": f"Increase {dim_name} to at least {min_dim_limit}mm.",
                })
                confidence -= 0.05

        # ── Tolerance checks (ISO 2768) ────────────────────────────
        tolerance_issues = self._check_iso_tolerances(length, width, height)
        for tol_issue in tolerance_issues:
            issues.append(tol_issue)
            confidence -= 0.03

        # ── Surface finish feasibility ─────────────────────────────
        if num_faces > 0 and surface_area > 0:
            avg_face_area = surface_area / num_faces
            if avg_face_area < 0.5:
                issues.append({
                    "type": "surface_finish_concern",
                    "severity": "LOW",
                    "location": "surface mesh",
                    "message": f"Very small average face area ({avg_face_area:.3f}mm²) — may require special surface finishing.",
                    "suggestion": "Verify surface finish requirements. Consider polishing or coating.",
                })

        # ── Minimum wall thickness compliance ──────────────────────
        min_wall_rule = rules.get("min_wall_thickness", 1.0)
        if min_thickness > 0 and min_thickness < min_wall_rule:
            issues.append({
                "type": "wall_thickness_noncompliant",
                "severity": "MEDIUM",
                "location": "thin regions",
                "message": f"Minimum thickness {min_thickness:.2f}mm does not meet standard ({min_wall_rule}mm).",
                "suggestion": f"Increase wall thickness to meet {min_wall_rule}mm minimum.",
            })
            confidence -= 0.05

        # ── Material volume check ──────────────────────────────────
        bbox_volume = length * width * height if (length and width and height) else 0
        if bbox_volume > 0 and volume > 0:
            fill_ratio = volume / bbox_volume
            if fill_ratio < 0.05:
                issues.append({
                    "type": "low_fill_ratio",
                    "severity": "LOW",
                    "location": "global",
                    "message": f"Material fill ratio is only {fill_ratio:.1%} of bounding box — verify design completeness.",
                    "suggestion": "Check for missing geometry or unintended voids.",
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
            "reasoning": self._build_reasoning(issues, length, width, height),
        }

    def _check_iso_tolerances(self, length: float, width: float, height: float) -> List[Dict]:
        """Check each dimension against ISO 2768 medium tolerance limits."""
        issues = []
        for dim_name, dim_val in [("length", length), ("width", width), ("height", height)]:
            if dim_val <= 0:
                continue
            tolerance = self._get_iso_tolerance(dim_val)
            if tolerance is None:
                issues.append({
                    "type": "tolerance_out_of_range",
                    "severity": "LOW",
                    "location": dim_name,
                    "message": f"{dim_name.capitalize()} ({dim_val:.1f}mm) outside ISO 2768 tolerance table range.",
                    "suggestion": "Specify custom tolerance for this dimension.",
                })
        return issues

    def _get_iso_tolerance(self, dimension: float) -> float | None:
        """Look up ISO 2768 medium tolerance for a given dimension."""
        for (lo, hi), tol in self.ISO_2768_MEDIUM.items():
            if lo <= dimension < hi:
                return tol
        return None

    def _build_reasoning(self, issues, length, width, height) -> str:
        parts = [f"Compliance check against ISO 2768 medium. Dimensions: {length:.1f} x {width:.1f} x {height:.1f} mm."]
        if issues:
            high = sum(1 for i in issues if i["severity"] == "HIGH")
            med = sum(1 for i in issues if i["severity"] == "MEDIUM")
            parts.append(f"Found {len(issues)} compliance issue(s) ({high} HIGH, {med} MEDIUM).")
        else:
            parts.append("All dimensions and tolerances within acceptable limits.")
        return " ".join(parts)
