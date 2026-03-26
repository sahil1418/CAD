"""
Intent Agent — Compares design metadata against the submitted design brief.
Uses keyword matching and simple NLP-style similarity.
"""

from typing import Dict, Any, List
import re
from agents.base_agent import BaseAgent


class IntentAgent(BaseAgent):
    agent_name = "intent"

    # Keyword → geometry property mapping
    INTENT_KEYWORDS = {
        "lightweight": {"check": "volume", "condition": "low", "threshold": 5000},
        "light": {"check": "volume", "condition": "low", "threshold": 5000},
        "compact": {"check": "bounding_box_volume", "condition": "low", "threshold": 50000},
        "small": {"check": "bounding_box_volume", "condition": "low", "threshold": 10000},
        "strong": {"check": "min_thickness", "condition": "high", "threshold": 3.0},
        "robust": {"check": "min_thickness", "condition": "high", "threshold": 3.0},
        "durable": {"check": "min_thickness", "condition": "high", "threshold": 2.0},
        "simple": {"check": "complexity_score", "condition": "low", "threshold": 0.4},
        "complex": {"check": "complexity_score", "condition": "high", "threshold": 0.5},
        "detailed": {"check": "num_faces", "condition": "high", "threshold": 50},
        "hollow": {"check": "has_internal_cavities", "condition": "equals", "threshold": True},
        "solid": {"check": "has_internal_cavities", "condition": "equals", "threshold": False},
        "flat": {"check": "aspect_ratio_max", "condition": "high", "threshold": 5.0},
        "thin": {"check": "avg_thickness", "condition": "low", "threshold": 3.0},
        "thick": {"check": "avg_thickness", "condition": "high", "threshold": 5.0},
        "smooth": {"check": "sharp_edge_count", "condition": "low", "threshold": 5},
        "aerodynamic": {"check": "sharp_edge_count", "condition": "low", "threshold": 3},
        "precise": {"check": "num_faces", "condition": "high", "threshold": 100},
        "machinable": {"check": "complexity_score", "condition": "low", "threshold": 0.5},
    }

    def _analyze(self, design_data: Dict[str, Any], shared_context: Dict[str, Any]) -> Dict[str, Any]:
        issues: List[Dict[str, Any]] = []
        design_brief = shared_context.get("design_brief", "")

        if not design_brief.strip():
            return self._fallback_from_geometry(design_data)

        # Normalize brief text
        brief_lower = design_brief.lower()
        brief_words = set(re.findall(r'\b\w+\b', brief_lower))

        # ── Keyword matching ───────────────────────────────────────
        matched_keywords = []
        mismatches = []
        matches = []

        for keyword, rule in self.INTENT_KEYWORDS.items():
            if keyword in brief_words:
                matched_keywords.append(keyword)
                is_aligned = self._check_alignment(design_data, rule)
                if is_aligned:
                    matches.append(keyword)
                else:
                    mismatches.append(keyword)
                    issues.append({
                        "type": "intent_mismatch",
                        "severity": "MEDIUM",
                        "location": f"keyword: '{keyword}'",
                        "message": f"Design brief specifies '{keyword}' but geometry does not match this intent.",
                        "suggestion": f"Modify design to better align with '{keyword}' requirement.",
                    })

        # ── Structural results cross-reference ─────────────────────
        previous = shared_context.get("previous_results", [])
        structural_issues = []
        for prev in previous:
            if prev.get("agent") == "structural" and prev.get("verdict") == "FAIL":
                if any(w in brief_lower for w in ["strong", "robust", "durable", "structural"]):
                    issues.append({
                        "type": "intent_structural_conflict",
                        "severity": "HIGH",
                        "location": "cross-agent",
                        "message": "Design brief requires structural strength, but Structural Agent reported FAIL.",
                        "suggestion": "Address structural issues before claiming structural intent.",
                    })

        # ── Confidence & Verdict ───────────────────────────────────
        if not matched_keywords:
            confidence = 0.6
            verdict = "WARN"
            issues.append({
                "type": "no_keywords_matched",
                "severity": "LOW",
                "location": "design brief",
                "message": "No recognized design intent keywords found in the brief.",
                "suggestion": "Use descriptive terms like 'lightweight', 'compact', 'strong', 'simple', etc.",
            })
        else:
            match_ratio = len(matches) / len(matched_keywords) if matched_keywords else 0
            confidence = 0.5 + 0.45 * match_ratio

            if match_ratio >= 0.8:
                verdict = "PASS"
            elif match_ratio >= 0.5:
                verdict = "WARN"
            else:
                verdict = "FAIL"

        return {
            "agent": self.agent_name,
            "verdict": verdict,
            "confidence": round(confidence, 3),
            "issues": issues,
            "reasoning": self._build_reasoning(matched_keywords, matches, mismatches, design_brief),
        }

    def _check_alignment(self, design_data: Dict, rule: Dict) -> bool:
        """Check if a design property aligns with a keyword intent."""
        check = rule["check"]
        condition = rule["condition"]
        threshold = rule["threshold"]

        # Get the property value
        if check == "bounding_box_volume":
            bb = design_data.get("bounding_box", {})
            value = bb.get("x", 0) * bb.get("y", 0) * bb.get("z", 0)
        elif check == "aspect_ratio_max":
            ratios = design_data.get("aspect_ratios", [1])
            value = max(ratios) if ratios else 1
        else:
            value = design_data.get(check, 0)

        # Evaluate condition
        if condition == "low":
            return value < threshold
        elif condition == "high":
            return value >= threshold
        elif condition == "equals":
            return value == threshold
        return False

    def _build_reasoning(self, matched, matches, mismatches, brief) -> str:
        parts = [f"Design intent analysis against brief: '{brief[:100]}{'...' if len(brief) > 100 else ''}'."]
        if matched:
            parts.append(f"Keywords detected: {', '.join(matched)}.")
            parts.append(f"Aligned: {', '.join(matches) if matches else 'none'}.")
            if mismatches:
                parts.append(f"Mismatched: {', '.join(mismatches)}.")
        else:
            parts.append("No recognized intent keywords found.")
        return " ".join(parts)

    def _fallback_from_geometry(self, design_data: Dict[str, Any]) -> Dict[str, Any]:
        """Infer intent from geometry when no design brief is provided."""
        traits = []
        complexity = design_data.get("complexity_score", 0)
        volume = design_data.get("volume", 0)
        faces = design_data.get("num_faces", 0)
        thickness = design_data.get("avg_thickness", 0)
        cavities = design_data.get("has_internal_cavities", False)

        if complexity > 0.6:
            traits.append("complex")
        elif complexity < 0.3:
            traits.append("simple")

        if volume < 3000:
            traits.append("compact/lightweight")
        elif volume > 20000:
            traits.append("large-scale")

        if faces > 100:
            traits.append("high-detail")
        elif faces < 20:
            traits.append("low-poly")

        if thickness and thickness < 3:
            traits.append("thin-walled")

        if cavities:
            traits.append("hollow/internal-cavity")

        if not traits:
            traits.append("general-purpose")

        inferred = " ".join(traits) + " structural component"

        # Confidence based on how many geometry signals we have
        confidence = min(0.4 + len(traits) * 0.08, 0.7)

        return {
            "agent": self.agent_name,
            "verdict": "WARN",
            "confidence": round(confidence, 3),
            "inferred_intent": inferred,
            "issues": [{
                "type": "inferred_intent",
                "severity": "LOW",
                "location": "input",
                "message": f"No design brief provided — inferred intent: \"{inferred}\"",
                "suggestion": "Provide a design brief for more accurate intent validation.",
            }],
            "reasoning": f"No design brief provided. Inferred intent from geometry: \"{inferred}\". "
                         f"Geometry signals: complexity={complexity:.2f}, volume={volume:.0f}, faces={faces}, "
                         f"avg_thickness={thickness:.1f}, cavities={cavities}.",
        }

