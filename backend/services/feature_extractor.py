"""
Feature Extractor — Normalization Layer.
Converts raw parser output into a standardized NormalizedDesignData dict
that ALL agents consume identically.
"""

import numpy as np
from typing import Dict, Any, List


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

    # ── Bounding box ───────────────────────────────────────────────
    if num_vertices > 0:
        mins = vertices.min(axis=0)
        maxs = vertices.max(axis=0)
        bbox = {"x": float(maxs[0] - mins[0]), "y": float(maxs[1] - mins[1]), "z": float(maxs[2] - mins[2])}
        dimensions = {"length": float(maxs[0] - mins[0]), "width": float(maxs[1] - mins[1]), "height": float(maxs[2] - mins[2])}
    else:
        bbox = {"x": 0, "y": 0, "z": 0}
        dimensions = {"length": 0, "width": 0, "height": 0}

    # ── Estimated volume & surface area ────────────────────────────
    volume = _estimate_volume(vertices, faces)
    surface_area = _estimate_surface_area(vertices, faces)

    # ── Thickness estimation ───────────────────────────────────────
    thicknesses = _estimate_thicknesses(vertices, faces)
    avg_thickness = float(np.mean(thicknesses)) if thicknesses else 0.0
    min_thickness = float(np.min(thicknesses)) if thicknesses else 0.0

    # ── Complexity score ───────────────────────────────────────────
    complexity_score = _compute_complexity(num_vertices, num_faces, normals)

    # ── Edge analysis ──────────────────────────────────────────────
    num_edges = _count_edges(faces)
    sharp_edge_count = _count_sharp_edges(vertices, faces, normals)

    # ── Aspect ratios ──────────────────────────────────────────────
    aspect_ratios = _compute_aspect_ratios(dimensions)

    # ── Depth analysis ─────────────────────────────────────────────
    max_depth = dimensions.get("height", 0)

    # ── Internal cavities heuristic ────────────────────────────────
    has_internal_cavities = _detect_internal_cavities(normals)

    return {
        "num_faces": num_faces,
        "num_edges": num_edges,
        "num_vertices": num_vertices,
        "bounding_box": bbox,
        "dimensions": dimensions,
        "avg_thickness": avg_thickness,
        "min_thickness": min_thickness,
        "surface_area": surface_area,
        "volume": volume,
        "complexity_score": complexity_score,
        "aspect_ratios": aspect_ratios,
        "face_normals": normals[:50] if normals else [],  # cap for performance
        "has_internal_cavities": has_internal_cavities,
        "sharp_edge_count": sharp_edge_count,
        "max_depth": max_depth,
    }


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
                # Signed volume of tetrahedron with origin
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


def _estimate_thicknesses(vertices: np.ndarray, faces: List) -> List[float]:
    """
    Heuristic thickness estimation: sample opposing face pairs
    and measure perpendicular distances.
    """
    if len(vertices) < 4:
        return [1.0]  # default

    # Sample-based approach: measure distances between random vertex pairs
    np.random.seed(0)
    n = min(len(vertices), 50)
    indices = np.random.choice(len(vertices), size=n, replace=False)
    sampled = vertices[indices]

    thicknesses = []
    for i in range(0, len(sampled) - 1, 2):
        dist = float(np.linalg.norm(sampled[i] - sampled[i + 1]))
        if dist > 0.01:
            thicknesses.append(dist)

    return thicknesses if thicknesses else [1.0]


def _compute_complexity(num_verts: int, num_faces: int, normals: List) -> float:
    """
    Complexity score from 0.0 (trivial) to 1.0 (very complex).
    Based on vertex/face count and normal direction variance.
    """
    # Base complexity from polygon count
    geo_complexity = min(1.0, (num_verts + num_faces) / 2000.0)

    # Normal variance contributes to complexity
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
            if angle > 60:  # sharp edge threshold
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
