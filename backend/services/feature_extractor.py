"""
Feature Extractor — Normalization Layer.
Converts raw parser output into a standardized NormalizedDesignData dict
that ALL agents consume identically.

Includes:
  - Auto-scale detection (mm / m / unknown)
  - Unit normalization to mm
  - Thickness estimation via volume/surface_area
  - Normalized ratios (sharp_edge_ratio, complexity_score)
  - Sanity checks with warnings
"""

import numpy as np
from typing import Dict, Any, List, Tuple


def normalize_design_data(raw_geometry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform raw geometry (vertices, faces, normals) into a normalized,
    structured feature set that every agent reads from.
    """
    vertices = np.array(raw_geometry.get("vertices", []))
    faces = raw_geometry.get("faces", [])
    normals = raw_geometry.get("normals", [])

    num_vertices = len(vertices)
    num_faces = len(faces)
    warnings: List[str] = []

    # ── Scale detection & normalization ────────────────────────────
    scale_factor = 1.0
    detected_unit = "mm"

    if num_vertices > 0:
        raw_mins = vertices.min(axis=0)
        raw_maxs = vertices.max(axis=0)
        raw_dims = raw_maxs - raw_mins
        max_raw_dim = float(np.max(raw_dims))

        if max_raw_dim > 5000:
            # Likely raw meters or absurdly large — scale down aggressively
            scale_factor = 100.0 / max_raw_dim  # normalize largest dim to 100mm
            detected_unit = "scaled_down"
            warnings.append(
                f"Geometry scale appears very large (max dim: {max_raw_dim:.0f}). "
                f"Auto-normalized with factor {scale_factor:.6f}."
            )
        elif max_raw_dim > 1000:
            # Possibly mm but oversized — mild normalization
            scale_factor = 500.0 / max_raw_dim
            detected_unit = "large_mm"
            warnings.append(
                f"Large geometry detected (max dim: {max_raw_dim:.0f}mm). "
                f"Scaled to fit 500mm envelope."
            )
        elif max_raw_dim < 0.01:
            # Likely meters — convert to mm
            scale_factor = 1000.0
            detected_unit = "meters"
            warnings.append(
                f"Very small geometry (max dim: {max_raw_dim:.6f}). "
                f"Assumed meters, converted to mm."
            )
        elif max_raw_dim < 1.0:
            # Likely cm or small m
            scale_factor = 10.0
            detected_unit = "cm"
            warnings.append(
                f"Small geometry (max dim: {max_raw_dim:.3f}). "
                f"Assumed cm, converted to mm."
            )
        # else: reasonable mm range, keep scale_factor = 1.0

        # Apply scaling
        if scale_factor != 1.0:
            vertices = vertices * scale_factor

    # ── Bounding box (post-scaling) ───────────────────────────────
    if num_vertices > 0:
        mins = vertices.min(axis=0)
        maxs = vertices.max(axis=0)
        bbox = {"x": float(maxs[0] - mins[0]), "y": float(maxs[1] - mins[1]), "z": float(maxs[2] - mins[2])}
        dimensions = {"length": float(maxs[0] - mins[0]), "width": float(maxs[1] - mins[1]), "height": float(maxs[2] - mins[2])}
    else:
        bbox = {"x": 0, "y": 0, "z": 0}
        dimensions = {"length": 0, "width": 0, "height": 0}

    # ── Estimated volume & surface area (post-scaling) ─────────────
    volume = _estimate_volume(vertices, faces)
    surface_area = _estimate_surface_area(vertices, faces)

    # ── Thickness estimation: volume / surface_area (clamped) ──────
    if surface_area > 0 and volume > 0:
        avg_thickness = volume / surface_area
    else:
        avg_thickness = 1.0  # safe default

    avg_thickness = _clamp(avg_thickness, 0.1, 50.0)
    min_thickness = avg_thickness * 0.6  # heuristic: min ≈ 60% of average

    # ── Complexity score (normalized 0-1) ──────────────────────────
    complexity_score = _compute_complexity(num_vertices, num_faces, normals)

    # ── Edge analysis ──────────────────────────────────────────────
    num_edges = _count_edges(faces)
    sharp_edge_count = _count_sharp_edges(vertices, faces, normals)
    sharp_edge_ratio = sharp_edge_count / max(num_edges, 1)

    # ── Aspect ratios ──────────────────────────────────────────────
    aspect_ratios = _compute_aspect_ratios(dimensions)

    # ── Depth analysis ─────────────────────────────────────────────
    max_depth = dimensions.get("height", 0)

    # ── Internal cavities heuristic ────────────────────────────────
    has_internal_cavities = _detect_internal_cavities(normals)

    # ── Sanity checks ──────────────────────────────────────────────
    max_dim = max(dimensions.get("length", 0), dimensions.get("width", 0), dimensions.get("height", 0))
    if max_dim > 2000:
        warnings.append(f"Post-normalization dimension still large ({max_dim:.0f}mm). Results may be approximate.")
    if avg_thickness > 100:
        warnings.append(f"Estimated thickness ({avg_thickness:.1f}mm) seems high. Clamped to 50mm.")
        avg_thickness = 50.0
        min_thickness = 30.0
    if volume > 1e8:
        warnings.append(f"Volume ({volume:.0f}mm³) is very large. Cost estimates may be approximate.")

    return {
        "num_faces": num_faces,
        "num_edges": num_edges,
        "num_vertices": num_vertices,
        "bounding_box": bbox,
        "dimensions": dimensions,
        "avg_thickness": round(avg_thickness, 2),
        "min_thickness": round(min_thickness, 2),
        "surface_area": round(surface_area, 2),
        "volume": round(volume, 2),
        "complexity_score": complexity_score,
        "aspect_ratios": aspect_ratios,
        "face_normals": normals[:50] if normals else [],
        "has_internal_cavities": has_internal_cavities,
        "sharp_edge_count": sharp_edge_count,
        "sharp_edge_ratio": round(sharp_edge_ratio, 4),
        "max_depth": max_depth,
        # Scale metadata
        "scale_info": {
            "detected_unit": detected_unit,
            "scale_factor": round(scale_factor, 6),
        },
        "warnings": warnings,
    }


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _estimate_volume(vertices: np.ndarray, faces: List) -> float:
    """Estimate volume using signed tetrahedron method for triangular faces."""
    if len(vertices) < 3 or len(faces) < 1:
        return 0.0

    total = 0.0
    for face in faces:
        if len(face) >= 3:
            try:
                v0 = vertices[face[0]]
                v1 = vertices[face[1]]
                v2 = vertices[face[2]]
                total += np.dot(v0, np.cross(v1, v2)) / 6.0
            except (IndexError, ValueError):
                continue
    return abs(float(total))


def _estimate_surface_area(vertices: np.ndarray, faces: List) -> float:
    """Sum triangle areas for all faces."""
    if len(vertices) < 3 or len(faces) < 1:
        return 0.0

    total = 0.0
    for face in faces:
        if len(face) >= 3:
            try:
                v0 = vertices[face[0]]
                v1 = vertices[face[1]]
                v2 = vertices[face[2]]
                edge1 = v1 - v0
                edge2 = v2 - v0
                total += np.linalg.norm(np.cross(edge1, edge2)) / 2.0
            except (IndexError, ValueError):
                continue
    return float(total)


def _compute_complexity(num_verts: int, num_faces: int, normals: List) -> float:
    """
    Complexity score from 0.0 (trivial) to 1.0 (very complex).
    Uses normalized face count (capped at 10000) + normal variance.
    """
    geo_complexity = min(1.0, num_faces / 10000.0)

    if normals and len(normals) > 2:
        normals_np = np.array(normals)
        variance = float(np.mean(np.var(normals_np, axis=0)))
        normal_complexity = min(1.0, variance * 3.0)
    else:
        normal_complexity = 0.5

    return round(0.6 * geo_complexity + 0.4 * normal_complexity, 3)


def _count_edges(faces: List) -> int:
    """Count unique edges from face list."""
    edges = set()
    for face in faces:
        for i in range(len(face)):
            e = tuple(sorted([face[i], face[(i + 1) % len(face)]]))
            edges.add(e)
    return len(edges)


def _count_sharp_edges(vertices: np.ndarray, faces: List, normals: List) -> int:
    """Count edges where adjacent face normals differ significantly."""
    if len(normals) < 2:
        return 0

    sharp = 0
    for i in range(len(normals) - 1):
        try:
            n1 = np.array(normals[i])
            n2 = np.array(normals[i + 1])
            dot = np.clip(np.dot(n1, n2), -1.0, 1.0)
            angle = np.degrees(np.arccos(dot))
            if angle > 60:
                sharp += 1
        except (ValueError, IndexError):
            continue
    return sharp


def _compute_aspect_ratios(dimensions: Dict[str, float]) -> List[float]:
    """Compute pairwise aspect ratios of bounding box dimensions."""
    vals = [max(dimensions.get(k, 0.001), 0.001) for k in ("length", "width", "height")]
    return [
        round(vals[0] / vals[1], 3),
        round(vals[1] / vals[2], 3),
        round(vals[0] / vals[2], 3),
    ]


def _detect_internal_cavities(normals: List) -> bool:
    """
    Heuristic: if a significant portion of normals point inward
    (negative dot product with outward reference), suspect cavities.
    """
    if len(normals) < 4:
        return False

    normals_np = np.array(normals)
    centroid = np.mean(normals_np, axis=0)
    inward_count = 0
    for n in normals_np:
        if np.dot(n, centroid) < 0:
            inward_count += 1

    return inward_count > len(normals) * 0.3
