"""
Manufacturing Agent — Detects undercuts, non-machinable geometry,
tight internal angles, and deep pockets.
"""

from typing import Dict, Any, List
import numpy as np
from agents.base_agent import BaseAgent


class ManufacturingAgent(BaseAgent):
    agent_name = "manufacturing"

    # Thresholds
    MIN_INTERNAL_ANGLE = 30.0         # degrees — below this is hard to machine
    MAX_DEPTH_RATIO = 4.0             # depth-to-width ratio for pockets
    UNDERCUT_NORMAL_THRESHOLD = 0.3   # fraction of inward normals indicating undercut
    MIN_FEATURE_SIZE = 1.0            # mm — features below this are hard to machine

    def _analyze(self, design_data: Dict[str, Any], shared_context: Dict[str, Any]) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        confidence = 0.88

        normals = design_data.get("face_normals", [])
        dimensions = design_data.get("dimensions", {})
        complexity = design_data.get("complexity_score", 0)
        min_thickness = design_data.get("min_thickness", 0)
        max_depth = design_data.get("max_depth", 0)
        has_cavities = design_data.get("has_internal_cavities", False)
        sharp_edges = design_data.get("sharp_edge_count", 0)
        num_faces = design_data.get("num_faces", 0)
        bbox = design_data.get("bounding_box", {})

        # ── Undercut detection ─────────────────────────────────────
        undercut_score = self._detect_undercuts(normals)
        if undercut_score > self.UNDERCUT_NORMAL_THRESHOLD:
            issues.append({
                "type": "undercut",
                "severity": "HIGH",
                "location": "internal surfaces",
                "message": f"Potential undercuts detected ({undercut_score:.0%} inward-facing surfaces). Cannot be machined with standard 3-axis CNC.",
                "suggestion": "Redesign to eliminate undercuts, or plan for 5-axis machining / EDM.",
            })
            confidence -= 0.15

        # ── Non-machinable geometry (tight angles) ─────────────────
        tight_angles = self._detect_tight_angles(normals)
        if tight_angles > 5:
            issues.append({
                "type": "tight_internal_angle",
                "severity": "MEDIUM",
                "location": "edge intersections",
                "message": f"{tight_angles} tight internal angles (< {self.MIN_INTERNAL_ANGLE}°) detected — difficult for tool access.",
                "suggestion": "Increase internal radii to minimum 1.0mm for standard end mills.",
            })
            confidence -= 0.08

        # ── Deep pocket detection ──────────────────────────────────
        min_width = min(dimensions.get("length", 100), dimensions.get("width", 100))
        if min_width > 0 and max_depth > 0:
            depth_ratio = max_depth / min_width
            if depth_ratio > self.MAX_DEPTH_RATIO:
                issues.append({
                    "type": "deep_pocket",
                    "severity": "MEDIUM",
                    "location": "z-axis depth",
                    "message": f"Deep pocket ratio {depth_ratio:.1f}:1 exceeds limit ({self.MAX_DEPTH_RATIO}:1). Long tools required, risk of chatter.",
                    "suggestion": "Reduce pocket depth or increase width. Consider step-down machining strategy.",
                })
                confidence -= 0.06

        # ── Internal cavity manufacturability ──────────────────────
        if has_cavities:
            issues.append({
                "type": "internal_cavity_access",
                "severity": "HIGH",
                "location": "internal geometry",
                "message": "Internal cavities detected — may be inaccessible for standard machining.",
                "suggestion": "Split into multiple parts for assembly, or use additive manufacturing (3D printing).",
            })
            confidence -= 0.12

        # ── Very small feature check ───────────────────────────────
        if min_thickness > 0 and min_thickness < self.MIN_FEATURE_SIZE:
            issues.append({
                "type": "small_feature",
                "severity": "MEDIUM",
                "location": "thin regions",
                "message": f"Feature size {min_thickness:.2f}mm below minimum machinable size ({self.MIN_FEATURE_SIZE}mm).",
                "suggestion": "Increase minimum feature size or use micro-machining / EDM.",
            })
            confidence -= 0.05

        # ── Excessive face count (toolpath complexity) ─────────────
        if num_faces > 500:
            issues.append({
                "type": "complex_toolpath",
                "severity": "LOW",
                "location": "global",
                "message": f"High face count ({num_faces}) — complex toolpath generation, longer machining time.",
                "suggestion": "Simplify geometry where possible. Use surface smoothing.",
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
            "reasoning": self._build_reasoning(issues, undercut_score, tight_angles, has_cavities),
        }

    def _detect_undercuts(self, normals: List) -> float:
        """Fraction of normals pointing predominantly inward (Z < -0.5)."""
        if not normals:
            return 0.0
        inward = sum(1 for n in normals if len(n) >= 3 and n[2] < -0.5)
        return inward / len(normals)

    def _detect_tight_angles(self, normals: List) -> int:
        """Count adjacent normal pairs with very small angles between them."""
        if len(normals) < 2:
            return 0
        tight = 0
        for i in range(len(normals) - 1):
            try:
                n1 = np.array(normals[i])
                n2 = np.array(normals[i + 1])
                dot = np.clip(np.dot(n1, n2), -1.0, 1.0)
                angle = np.degrees(np.arccos(dot))
                if 0 < angle < self.MIN_INTERNAL_ANGLE:
                    tight += 1
            except (ValueError, IndexError):
                continue
        return tight

    def _build_reasoning(self, issues, undercut_score, tight_angles, cavities) -> str:
        parts = ["Manufacturing feasibility analysis complete."]
        parts.append(f"Undercut score: {undercut_score:.0%}, Tight angles: {tight_angles}.")
        if cavities:
            parts.append("Internal cavities present — accessibility concern.")
        if issues:
            parts.append(f"Found {len(issues)} manufacturability issue(s).")
        else:
            parts.append("Design is machinable with standard CNC processes.")
        return " ".join(parts)
