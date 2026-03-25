"""
Base Agent — Abstract base class for all validation agents.
Includes error handling with fallback result generation.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
import traceback


class BaseAgent(ABC):
    """
    Abstract base class that all validation agents must inherit from.
    Provides error-safe execution with fallback results.
    """

    agent_name: str = "base"

    @abstractmethod
    def _analyze(self, design_data: Dict[str, Any], shared_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Core analysis logic — implemented by each agent.

        Args:
            design_data: Normalized design data from feature_extractor.
            shared_context: Shared memory dict with geometry, rules, previous_results.

        Returns:
            dict with keys: agent, verdict, confidence, issues, reasoning
        """
        pass

    def analyze(self, design_data: Dict[str, Any], shared_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Safe wrapper around _analyze() with error handling and explainability enrichment.
        On failure, returns a fallback WARN result instead of crashing the pipeline.
        """
        try:
            result = self._analyze(design_data, shared_context)
            # Validate required keys
            assert "agent" in result
            assert "verdict" in result
            assert "confidence" in result
            # Enrich issues with explainability fields
            result["issues"] = [self._enrich_issue(i) for i in result.get("issues", [])]
            return result
        except Exception as e:
            error_trace = traceback.format_exc()
            return self._fallback_result(str(e), error_trace)

    @staticmethod
    def _enrich_issue(issue: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-add 'reason' and 'contributing_feature' for explainability."""
        if "reason" not in issue:
            # Derive reason from message + suggestion
            msg = issue.get("message", "")
            sug = issue.get("suggestion", "")
            issue["reason"] = f"{msg} {sug}".strip() if sug else msg

        if "contributing_feature" not in issue:
            # Derive contributing feature from type + location
            itype = issue.get("type", "unknown").replace("_", " ")
            loc = issue.get("location", "global")
            issue["contributing_feature"] = f"{itype} at {loc}"

        return issue

    def _fallback_result(self, error_msg: str, trace: str = "") -> Dict[str, Any]:
        """Generate a safe fallback result when agent analysis crashes."""
        return {
            "agent": self.agent_name,
            "verdict": "WARN",
            "confidence": 0.3,
            "issues": [
                {
                    "type": "agent_error",
                    "severity": "MEDIUM",
                    "location": "global",
                    "message": f"Agent '{self.agent_name}' encountered an error: {error_msg}",
                    "suggestion": "Review the input data and retry. Check logs for details.",
                }
            ],
            "reasoning": f"Agent failed with error: {error_msg}. Returning conservative WARN verdict.",
        }
