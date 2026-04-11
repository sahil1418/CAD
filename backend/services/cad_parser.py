"""
Simplified CAD file parser.
Supports STEP (.stp/.step) and OBJ (.obj) files.
Extracts raw geometry data: vertices, faces, normals.
"""

import os
import re
import numpy as np
from typing import Dict, List, Any


def parse_cad_file(filepath: str) -> Dict[str, Any]:
    """
    Parse a CAD file and return raw geometry data.
    Delegates to format-specific parsers based on extension.
    """
    ext = os.path.splitext(filepath)[1].lower()

    if ext in (".obj",):
        return _parse_obj(filepath)
    elif ext in (".stp", ".step"):
        return _parse_step(filepath)
    elif ext in (".stl",):
        return _parse_stl(filepath)
    else:
        # Fallback: generate synthetic geometry for demo/testing
        return _generate_synthetic_geometry(filepath)


def _parse_obj(filepath: str) -> Dict[str, Any]:
    """Parse a Wavefront OBJ file."""
    vertices = []
    faces = []
    normals = []

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if line.startswith("v "):
                parts = line.split()
                vertices.append([float(parts[1]), float(parts[2]), float(parts[3])])
            elif line.startswith("vn "):
                parts = line.split()
                normals.append([float(parts[1]), float(parts[2]), float(parts[3])])
            elif line.startswith("f "):
                parts = line.split()[1:]
                face = []
                for p in parts:
                    idx = int(p.split("/")[0]) - 1  # OBJ is 1-indexed
                    face.append(idx)
                faces.append(face)

    vertices_np = np.array(vertices) if vertices else np.zeros((0, 3))

    return {
        "format": "OBJ",
        "vertices": vertices_np.tolist(),
        "faces": faces,
        "normals": normals,
        "num_vertices": len(vertices),
        "num_faces": len(faces),
        "raw_file": filepath,
    }


def _parse_step(filepath: str) -> Dict[str, Any]:
    """
    Simplified STEP parser.
    Extracts geometric entities from STEP files using heuristic regex parsing.
    """
    vertices = []
    faces = []
    normals = []

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Extract CARTESIAN_POINT entries
    cart_points = re.findall(
        r"CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)\s*\)",
        content,
    )
    for p in cart_points:
        vertices.append([float(p[0]), float(p[1]), float(p[2])])

    # Extract DIRECTION entries as normals
    directions = re.findall(
        r"DIRECTION\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)\s*\)",
        content,
    )
    for d in directions:
        normals.append([float(d[0]), float(d[1]), float(d[2])])

    # Count ADVANCED_FACE entries as faces
    face_count = len(re.findall(r"ADVANCED_FACE", content))
    faces = [[i, i + 1, i + 2] for i in range(0, min(face_count * 3, len(vertices) - 2), 3)]

    vertices_np = np.array(vertices) if vertices else np.zeros((0, 3))

    return {
        "format": "STEP",
        "vertices": vertices_np.tolist(),
        "faces": faces,
        "normals": normals,
        "num_vertices": len(vertices),
        "num_faces": face_count,
        "raw_file": filepath,
    }


def _parse_stl(filepath: str) -> Dict[str, Any]:
    """
    Parse an STL file (binary or ASCII).
    Binary STL: 80-byte header + 4-byte triangle count + 50 bytes per triangle.
    ASCII STL: text-based with 'facet normal' and 'vertex' lines.
    """
    vertices = []
    faces = []
    normals = []

    with open(filepath, "rb") as f:
        header = f.read(80)
        # Check if ASCII by looking for 'solid' at start (heuristic)
        is_ascii = header.strip().startswith(b"solid") and b"\x00" not in header

    if is_ascii:
        # ASCII STL parsing
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            current_normal = None
            face_verts = []
            for line in f:
                line = line.strip()
                if line.startswith("facet normal"):
                    parts = line.split()
                    current_normal = [float(parts[2]), float(parts[3]), float(parts[4])]
                    normals.append(current_normal)
                elif line.startswith("vertex"):
                    parts = line.split()
                    v = [float(parts[1]), float(parts[2]), float(parts[3])]
                    vertices.append(v)
                    face_verts.append(len(vertices) - 1)
                elif line.startswith("endfacet"):
                    if len(face_verts) >= 3:
                        faces.append(face_verts[:3])
                    face_verts = []
    else:
        # Binary STL parsing
        import struct
        with open(filepath, "rb") as f:
            f.read(80)  # skip header
            num_triangles = struct.unpack("<I", f.read(4))[0]
            for i in range(num_triangles):
                data = f.read(50)  # 12 floats + 2 byte attribute
                if len(data) < 50:
                    break
                vals = struct.unpack("<12fH", data)
                normals.append([vals[0], vals[1], vals[2]])
                v_idx = len(vertices)
                vertices.append([vals[3], vals[4], vals[5]])
                vertices.append([vals[6], vals[7], vals[8]])
                vertices.append([vals[9], vals[10], vals[11]])
                faces.append([v_idx, v_idx + 1, v_idx + 2])

    vertices_np = np.array(vertices) if vertices else np.zeros((0, 3))

    return {
        "format": "STL",
        "vertices": vertices_np.tolist(),
        "faces": faces,
        "normals": normals,
        "num_vertices": len(vertices),
        "num_faces": len(faces),
        "raw_file": filepath,
    }


def _generate_synthetic_geometry(filepath: str) -> Dict[str, Any]:
    """
    Generate synthetic geometry for demo purposes when file format
    is not directly supported or for testing.
    """
    np.random.seed(42)
    num_verts = 120
    num_faces = 80

    vertices = (np.random.rand(num_verts, 3) * 100).tolist()
    faces = []
    for i in range(num_faces):
        face = [
            int(np.random.randint(0, num_verts)),
            int(np.random.randint(0, num_verts)),
            int(np.random.randint(0, num_verts)),
        ]
        faces.append(face)

    normals = []
    for _ in range(num_faces):
        n = np.random.randn(3)
        n = (n / np.linalg.norm(n)).tolist()
        normals.append(n)

    return {
        "format": "SYNTHETIC",
        "vertices": vertices,
        "faces": faces,
        "normals": normals,
        "num_vertices": num_verts,
        "num_faces": num_faces,
        "raw_file": filepath,
    }
