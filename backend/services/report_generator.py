"""
PDF Report Generator — Creates a structured, professional CAD validation report.
Uses reportlab for clean layout with headers, tables, and color-coded sections.
"""

import io
from datetime import datetime
from typing import Dict, Any, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)


# ── Color Palette ──────────────────────────────────────────────────
INDIGO = colors.HexColor("#4f46e5")
EMERALD = colors.HexColor("#10b981")
AMBER = colors.HexColor("#f59e0b")
RED = colors.HexColor("#ef4444")
SLATE_800 = colors.HexColor("#1e293b")
SLATE_200 = colors.HexColor("#e2e8f0")
SLATE_400 = colors.HexColor("#94a3b8")
WHITE = colors.white

VERDICT_COLORS = {"PASS": EMERALD, "CONDITIONAL_PASS": AMBER, "FAIL": RED}
SEVERITY_COLORS = {"HIGH": RED, "MEDIUM": AMBER, "LOW": colors.HexColor("#06b6d4")}

AGENT_LABELS = {
    "structural": "Structural",
    "manufacturing": "Manufacturing",
    "compliance": "Compliance",
    "intent": "Intent",
    "cost": "Cost",
}


def _build_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        fontSize=22, textColor=SLATE_800, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "SectionHead", parent=styles["Heading2"],
        fontSize=13, textColor=INDIGO, spaceBefore=14, spaceAfter=6,
        borderWidth=0, borderPadding=0,
    ))
    styles.add(ParagraphStyle(
        "BodyText2", parent=styles["BodyText"],
        fontSize=10, textColor=SLATE_800, leading=14,
    ))
    styles.add(ParagraphStyle(
        "SmallGray", parent=styles["BodyText"],
        fontSize=8, textColor=SLATE_400,
    ))
    return styles


def generate_report(consensus: Dict[str, Any], filename: str = "") -> bytes:
    """Generate a PDF report from consensus results. Returns PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=15 * mm,
    )
    styles = _build_styles()
    story: List[Any] = []

    verdict = consensus.get("final_verdict", "FAIL")
    score = consensus.get("design_score", consensus.get("score", 0))
    confidence = consensus.get("confidence", 0)
    uncertainty = consensus.get("uncertainty", 0)
    agents = consensus.get("agent_summary", consensus.get("agents", []))
    top3 = consensus.get("top_3_issues", [])
    breakdown = consensus.get("score_breakdown", {})
    worst = consensus.get("worst_agent", "")
    explanation = consensus.get("verdict_explanation", "")
    dissent = consensus.get("dissent_detected", False)
    dissent_details = consensus.get("dissent_details", [])
    fixes = consensus.get("recommended_fixes", [])
    all_issues = consensus.get("priority_issues", consensus.get("issues", []))

    # ── 1. Header ──────────────────────────────────────────────────
    story.append(Paragraph("CAD Validation Report", styles["ReportTitle"]))
    meta_parts = [f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}"]
    if filename:
        meta_parts.append(f"File: {filename}")
    story.append(Paragraph(" · ".join(meta_parts), styles["SmallGray"]))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200))
    story.append(Spacer(1, 8))

    # ── 2. Final Verdict ───────────────────────────────────────────
    story.append(Paragraph("Final Verdict", styles["SectionHead"]))
    vc = VERDICT_COLORS.get(verdict, RED)
    verdict_data = [
        ["Design Score", "Verdict", "Confidence", "Uncertainty"],
        [
            str(score) + " / 100",
            verdict.replace("_", " "),
            f"{confidence * 100:.0f}%",
            f"{uncertainty * 100:.0f}%",
        ],
    ]
    vt = Table(verdict_data, colWidths=[120, 120, 100, 100])
    vt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, 1), 11),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("TEXTCOLOR", (1, 1), (1, 1), vc),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(vt)

    # ── 3. Summary ─────────────────────────────────────────────────
    if explanation:
        story.append(Spacer(1, 4))
        story.append(Paragraph(
            f"<b>Summary:</b> {explanation}", styles["BodyText2"]
        ))

    # ── 4. Score Breakdown ─────────────────────────────────────────
    if breakdown:
        story.append(Paragraph("Score Breakdown", styles["SectionHead"]))
        max_scores = {"structural": 30, "manufacturing": 25, "compliance": 20, "intent": 15, "cost": 10}
        bd_data = [["Agent", "Score", "Max", "Status"]]
        for agent, val in breakdown.items():
            mx = max_scores.get(agent, 10)
            label = AGENT_LABELS.get(agent, agent)
            status = "✓" if val >= mx * 0.6 else "⚠" if val >= mx * 0.3 else "✕"
            if agent == worst:
                label += " (weakest)"
            bd_data.append([label, str(val), str(mx), status])
        bt = Table(bd_data, colWidths=[140, 80, 80, 60])
        bt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#f8fafc")]),
        ]))
        story.append(bt)

    # ── 5. Top Issues ──────────────────────────────────────────────
    if top3:
        story.append(Paragraph("Top Critical Issues", styles["SectionHead"]))
        for i, issue in enumerate(top3):
            sev = issue.get("severity", "LOW")
            msg = issue.get("message", "")
            src = AGENT_LABELS.get(issue.get("source_agent", ""), "")
            line = f"<b>#{i+1} [{sev}]</b> {msg}"
            if src:
                line += f"  <i>— {src}</i>"
            story.append(Paragraph(line, styles["BodyText2"]))
            story.append(Spacer(1, 2))

    # ── 6. Agent Breakdown ─────────────────────────────────────────
    if agents:
        story.append(Paragraph("Agent Reports", styles["SectionHead"]))
        for agent in agents:
            name = AGENT_LABELS.get(agent.get("agent", ""), agent.get("agent", ""))
            av = agent.get("verdict", "WARN")
            ac = agent.get("confidence", 0)
            avc = VERDICT_COLORS.get(av, AMBER)
            issues = agent.get("issues", [])

            story.append(Paragraph(
                f"<b>{name}</b> — {av} (confidence: {ac*100:.0f}%)",
                styles["BodyText2"],
            ))
            if agent.get("reasoning"):
                story.append(Paragraph(
                    f"<i>{agent['reasoning'][:200]}</i>",
                    styles["SmallGray"],
                ))
            if issues:
                for iss in issues[:4]:
                    sev = iss.get("severity", "LOW")
                    story.append(Paragraph(
                        f"  • [{sev}] {iss.get('message', '')}",
                        styles["BodyText2"],
                    ))
            story.append(Spacer(1, 4))

    # ── 7. Dissent ─────────────────────────────────────────────────
    if dissent and dissent_details:
        story.append(Paragraph("Agent Dissent", styles["SectionHead"]))
        for d in dissent_details:
            story.append(Paragraph(f"⚠ {d}", styles["BodyText2"]))

    # ── 8. Recommendations ─────────────────────────────────────────
    if fixes:
        story.append(Paragraph("Recommended Fixes", styles["SectionHead"]))
        for fix in fixes:
            story.append(Paragraph(f"→ {fix}", styles["BodyText2"]))
            story.append(Spacer(1, 2))

    # ── Footer note ────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=SLATE_200))
    story.append(Paragraph(
        "Generated by Multi-Agent CAD Validation System v1.0",
        styles["SmallGray"],
    ))

    doc.build(story)
    return buf.getvalue()
