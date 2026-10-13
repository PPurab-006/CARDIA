"""
Script to extract and assemble real BodyParts3D / Anatomography anatomical Heart
and separated Coronary Arteries (LAD, LCX, RCA) directly from NBDC LSDB Archive
via HTTP Range requests.

License: Creative Commons Attribution-Share Alike 2.1 Japan (CC BY-SA 2.1 JP)
Attribution: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan
Source: https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip
"""

import os
import sys
import json
import struct
import zlib
import urllib.request
import numpy as np

ARCHIVE_URL = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip"
OUTPUT_DIR = "frontend/public/models"

def get_central_directory(url):
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req) as resp:
        total_len = int(resp.headers["Content-Length"])
    
    # Read last 64KB for EOCD
    req = urllib.request.Request(url, headers={"Range": f"bytes={total_len - 65536}-{total_len - 1}"})
    with urllib.request.urlopen(req) as resp:
        tail = resp.read()
    
    eocd_pos = tail.rfind(b"\x50\x4b\x05\x06")
    if eocd_pos == -1:
        raise RuntimeError("EOCD record not found in zip tail")
    
    _, _, _, total_entries, cd_size, cd_offset = struct.unpack("<HHHHII", tail[eocd_pos+4:eocd_pos+20])
    print(f"Total entries: {total_entries}, CD size: {cd_size}, CD offset: {cd_offset}")
    
    # Read Central Directory
    req = urllib.request.Request(url, headers={"Range": f"bytes={cd_offset}-{cd_offset + cd_size - 1}"})
    with urllib.request.urlopen(req) as resp:
        cd_data = resp.read()
    
    entries = {}
    pos = 0
    while pos < len(cd_data):
        if cd_data[pos:pos+4] != b"\x50\x4b\x01\x02":
            break
        (_, _, _, method, _, _,
         crc, comp_size, uncomp_size, fname_len, extra_len, comment_len,
         _, _, _, local_hdr_offset) = struct.unpack("<HHHHHHIIIHHHHHII", cd_data[pos+4:pos+46])
        
        fname = cd_data[pos+46:pos+46+fname_len].decode("utf-8", errors="ignore")
        entries[fname] = {
            "method": method,
            "crc": crc,
            "comp_size": comp_size,
            "uncomp_size": uncomp_size,
            "offset": local_hdr_offset
        }
        pos += 46 + fname_len + extra_len + comment_len
    
    return entries

def download_obj_file(url, entry):
    start = entry["offset"]
    end = start + 30 + 128 + entry["comp_size"]
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(req) as resp:
        chunk = resp.read()
    
    loc_fname_len, loc_extra_len = struct.unpack("<HH", chunk[26:30])
    data_start = 30 + loc_fname_len + loc_extra_len
    raw_comp = chunk[data_start:data_start + entry["comp_size"]]
    
    if entry["method"] == 8:
        return zlib.decompress(raw_comp, -15).decode("utf-8", errors="ignore")
    return raw_comp.decode("utf-8", errors="ignore")

def parse_obj(obj_text):
    vertices = []
    faces = []
    for line in obj_text.splitlines():
        line = line.strip()
        if line.startswith("v "):
            parts = line.split()
            vertices.append([float(parts[1]), float(parts[2]), float(parts[3])])
        elif line.startswith("f "):
            parts = line.split()
            # Handle f v/vt/vn or f v
            face_indices = []
            for p in parts[1:]:
                idx = int(p.split("/")[0]) - 1
                face_indices.append(idx)
            # Triangulate if quad or polygon
            for i in range(1, len(face_indices) - 1):
                faces.append([face_indices[0], face_indices[i], face_indices[i+1]])
    return vertices, faces

def merge_objs(obj_texts):
    all_verts = []
    all_faces = []
    offset = 0
    for text in obj_texts:
        verts, faces = parse_obj(text)
        if not verts:
            continue
        all_verts.extend(verts)
        for f in faces:
            all_faces.append([f[0] + offset, f[1] + offset, f[2] + offset])
        offset += len(verts)
    return np.array(all_verts, dtype=np.float32), np.array(all_faces, dtype=np.int32)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs("artifacts/3d", exist_ok=True)
    
    print("Connecting to BodyParts3D NBDC LSDB archive...")
    entries = get_central_directory(ARCHIVE_URL)
    print(f"Archive central directory loaded ({len(entries)} files available).")
    
    # 1. Map component files based on BodyParts3D FMA part-of definitions
    # LAD: Anterior interventricular branch & diagonals (FJ2631 to FJ2648)
    lad_files = [f"partof_BP3D_4.0_obj_99/FJ{i}.obj" for i in range(2631, 2649) if f"partof_BP3D_4.0_obj_99/FJ{i}.obj" in entries]
    
    # LCX: Circumflex branch & obtuse marginals (FJ2649 to FJ2654)
    lcx_files = [f"partof_BP3D_4.0_obj_99/FJ{i}.obj" for i in range(2649, 2655) if f"partof_BP3D_4.0_obj_99/FJ{i}.obj" in entries]
    
    # RCA: Right coronary artery, marginals, conus, PDA (FJ2667 to FJ2723)
    rca_files = [f"partof_BP3D_4.0_obj_99/FJ{i}.obj" for i in range(2667, 2724) if f"partof_BP3D_4.0_obj_99/FJ{i}.obj" in entries]
    
    # Left Main coronary trunk: (FJ2737)
    lm_files = ["partof_BP3D_4.0_obj_99/FJ2737.obj"] if "partof_BP3D_4.0_obj_99/FJ2737.obj" in entries else []
    
    # Heart Myocardium (External muscular walls of ventricles, atria, base)
    # Exclude internal blood cavity element files (FJ2422, FJ2423, FJ2424, FJ2425)
    cavities = {"FJ2422", "FJ2423", "FJ2424", "FJ2425"}
    heart_files = [f"partof_BP3D_4.0_obj_99/FJ{i}.obj" for i in range(2417, 2500) 
                   if f"partof_BP3D_4.0_obj_99/FJ{i}.obj" in entries and f"FJ{i}" not in cavities]
    
    print(f"Downloading LAD parts ({len(lad_files)} files)...")
    lad_objs = [download_obj_file(ARCHIVE_URL, entries[f]) for f in lad_files]
    
    print(f"Downloading LCX parts ({len(lcx_files)} files)...")
    lcx_objs = [download_obj_file(ARCHIVE_URL, entries[f]) for f in lcx_files]
    
    print(f"Downloading RCA parts ({len(rca_files)} files)...")
    rca_objs = [download_obj_file(ARCHIVE_URL, entries[f]) for f in rca_files]
    
    print(f"Downloading Left Main trunk ({len(lm_files)} files)...")
    lm_objs = [download_obj_file(ARCHIVE_URL, entries[f]) for f in lm_files]
    
    print(f"Downloading Heart Myocardium parts ({len(heart_files)} files)...")
    heart_objs = [download_obj_file(ARCHIVE_URL, entries[f]) for f in heart_files]
    
    print("Assembling anatomical mesh structures...")
    # Add LM trunk to both LAD and LCX root or to LAD
    lad_verts, lad_faces = merge_objs(lm_objs + lad_objs)
    lcx_verts, lcx_faces = merge_objs(lcx_objs)
    rca_verts, rca_faces = merge_objs(rca_objs)
    heart_verts, heart_faces = merge_objs(heart_objs)
    
    print(f"Heart: {len(heart_verts)} verts, {len(heart_faces)} faces")
    print(f"LAD:   {len(lad_verts)} verts, {len(lad_faces)} faces")
    print(f"LCX:   {len(lcx_verts)} verts, {len(lcx_faces)} faces")
    print(f"RCA:   {len(rca_verts)} verts, {len(rca_faces)} faces")
    
    # Compute heart bounding box and centroid for unified world alignment
    all_v = np.vstack([heart_verts, lad_verts, lcx_verts, rca_verts])
    min_b = np.min(all_v, axis=0)
    max_b = np.max(all_v, axis=0)
    center = (min_b + max_b) / 2.0
    scale = 3.2 / np.max(max_b - min_b)  # Fit within ~3.2 units in Three.js
    
    print(f"Centering: centroid={center}, scale={scale}")
    
    def transform_verts(verts):
        # Center, scale, and adjust anatomical orientation for medical workstation viewer:
        # BodyParts3D coordinates: X=Right-to-Left, Y=Anterior-to-Posterior, Z=Inferior-to-Superior
        # Standard Three.js coordinates: Y is UP, Z is TOWARDS camera, X is RIGHT.
        # Anatomical view: Rotate so apex points slightly anteroinferiorly towards left.
        v_centered = (verts - center) * scale
        # Map: ThreeJS X = v[0], ThreeJS Y = v[2], ThreeJS Z = -v[1]
        v_three = np.zeros_like(v_centered)
        v_three[:, 0] = v_centered[:, 0]
        v_three[:, 1] = v_centered[:, 2]  # Z (superior) -> Y (up)
        v_three[:, 2] = -v_centered[:, 1] # -Y (posterior->anterior) -> Z (front)
        return v_three
    
    heart_verts_t = transform_verts(heart_verts)
    lad_verts_t = transform_verts(lad_verts)
    lcx_verts_t = transform_verts(lcx_verts)
    rca_verts_t = transform_verts(rca_verts)
    
    # Function to write clean OBJ
    def write_obj(filepath, verts, faces, name):
        header = [
            f"# BodyParts3D Anatomical Resource: {name}",
            "# Attribution: BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan",
            "# License: CC BY-SA 2.1 JP (https://creativecommons.org/licenses/by-sa/2.1/jp/)",
            "# Source: https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip",
            f"o {name}"
        ]
        with open(filepath, "w") as f:
            f.write("\n".join(header) + "\n")
            for v in verts:
                f.write(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
            for tri in faces:
                f.write(f"f {tri[0]+1} {tri[1]+1} {tri[2]+1}\n")
        print(f"Wrote {filepath} ({os.path.getsize(filepath) / 1024:.1f} KB)")

    # Function to export to Three.js BufferGeometry JSON for instant zero-dependency loading
    def write_buffer_geometry_json(filepath, verts, faces, name):
        # Compute face normals for clean shading
        normals = np.zeros_like(verts)
        v0 = verts[faces[:, 0]]
        v1 = verts[faces[:, 1]]
        v2 = verts[faces[:, 2]]
        face_normals = np.cross(v1 - v0, v2 - v0)
        norm_lens = np.linalg.norm(face_normals, axis=1, keepdims=True)
        norm_lens[norm_lens == 0] = 1.0
        face_normals /= norm_lens
        
        for i, f in enumerate(faces):
            normals[f[0]] += face_normals[i]
            normals[f[1]] += face_normals[i]
            normals[f[2]] += face_normals[i]
        
        v_lens = np.linalg.norm(normals, axis=1, keepdims=True)
        v_lens[v_lens == 0] = 1.0
        normals /= v_lens
        
        geo_dict = {
            "metadata": {
                "version": 4.5,
                "type": "BufferGeometry",
                "generator": "CARDIA BodyParts3D Exporter",
                "license": "CC BY-SA 2.1 Japan",
                "attribution": "BodyParts3D, (c) The Database Center for Life Science"
            },
            "data": {
                "attributes": {
                    "position": {
                        "itemSize": 3,
                        "type": "Float32Array",
                        "array": [round(float(x), 5) for x in verts.flatten()]
                    },
                    "normal": {
                        "itemSize": 3,
                        "type": "Float32Array",
                        "array": [round(float(x), 4) for x in normals.flatten()]
                    }
                },
                "index": {
                    "type": "Uint32Array",
                    "array": [int(x) for x in faces.flatten()]
                }
            }
        }
        with open(filepath, "w") as f:
            json.dump(geo_dict, f)
        print(f"Wrote JSON geometry {filepath} ({os.path.getsize(filepath) / 1024:.1f} KB)")
        
    # Export OBJ files (for standard external 3D usage & compliance)
    write_obj(os.path.join(OUTPUT_DIR, "heart_myocardium.obj"), heart_verts_t, heart_faces, "HeartMyocardium")
    write_obj(os.path.join(OUTPUT_DIR, "lad.obj"), lad_verts_t, lad_faces, "LAD_CoronaryArtery")
    write_obj(os.path.join(OUTPUT_DIR, "lcx.obj"), lcx_verts_t, lcx_faces, "LCX_CoronaryArtery")
    write_obj(os.path.join(OUTPUT_DIR, "rca.obj"), rca_verts_t, rca_faces, "RCA_CoronaryArtery")
    
    # Export optimized Three.js BufferGeometry JSON files (loads directly via fetch in React)
    write_buffer_geometry_json(os.path.join(OUTPUT_DIR, "heart_myocardium.json"), heart_verts_t, heart_faces, "HeartMyocardium")
    write_buffer_geometry_json(os.path.join(OUTPUT_DIR, "lad.json"), lad_verts_t, lad_faces, "LAD_CoronaryArtery")
    write_buffer_geometry_json(os.path.join(OUTPUT_DIR, "lcx.json"), lcx_verts_t, lcx_faces, "LCX_CoronaryArtery")
    write_buffer_geometry_json(os.path.join(OUTPUT_DIR, "rca.json"), rca_verts_t, rca_faces, "RCA_CoronaryArtery")
    
    # Write provenance and attribution record
    provenance = {
        "source": "BodyParts3D / Anatomography",
        "portal_url": "https://lifesciencedb.jp/bp3d/",
        "download_archive": "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip",
        "license": "Creative Commons Attribution-Share Alike 2.1 Japan (CC BY-SA 2.1 JP)",
        "license_url": "https://creativecommons.org/licenses/by-sa/2.1/jp/",
        "attribution_notice": "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan",
        "structures": {
            "Heart": {
                "fma_id": "FMA7088",
                "description": "Myocardium and cardiac chambers (excluding blood cavities)",
                "parts_count": len(heart_files),
                "vertices": int(len(heart_verts_t)),
                "triangles": int(len(heart_faces))
            },
            "LAD": {
                "fma_id": "FMA3862 / FMA74912",
                "description": "Anterior interventricular branch of left coronary artery + diagonal branches + left main trunk",
                "parts_count": len(lad_files) + len(lm_files),
                "vertices": int(len(lad_verts_t)),
                "triangles": int(len(lad_faces))
            },
            "LCX": {
                "fma_id": "FMA3895",
                "description": "Circumflex branch of left coronary artery + obtuse marginal branches",
                "parts_count": len(lcx_files),
                "vertices": int(len(lcx_verts_t)),
                "triangles": int(len(lcx_faces))
            },
            "RCA": {
                "fma_id": "FMA50039 / FMA3802",
                "description": "Right coronary artery trunk, marginal, conus, and posterior interventricular branches",
                "parts_count": len(rca_files),
                "vertices": int(len(rca_verts_t)),
                "triangles": int(len(rca_faces))
            }
        },
        "modifications": "Extracted from polygon-reduced 4.0 release (99% reduction rate); centered around heart centroid; transformed to Three.js coordinate system (Y-up, Z-forward); precomputed vertex normals for smooth standard shading."
    }
    with open("artifacts/3d/BODYPARTS3D_PROVENANCE.json", "w") as f:
        json.dump(provenance, f, indent=2)
    print("Saved provenance metadata to artifacts/3d/BODYPARTS3D_PROVENANCE.json")
    print("SUCCESS: All anatomical meshes extracted and prepared.")

if __name__ == "__main__":
    main()
