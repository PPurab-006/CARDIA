"""
Download and verify the official Extension of Z-Alizadeh Sani Dataset (UCI ID 411).
Saves the raw archive in data/raw/ and the verified processed dataset in data/processed/alizadeh_sani.csv.
Generates results/dataset_audit.json with dataset provenance, schema, and target distributions.
"""

import json
import os
import sys
import urllib.request
import zipfile
import pandas as pd
import numpy as np

UCI_DATASET_ID = 411
UCI_DATASET_NAME = "Extension of Z-Alizadeh Sani Dataset"
UCI_DOWNLOAD_URL = "https://archive.ics.uci.edu/static/public/411/extention+of+z+alizadeh+sani+dataset.zip"
DOI = "10.24432/C5461K"

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_DIR = os.path.join(PROJECT_ROOT, "data", "raw")
PROCESSED_DIR = os.path.join(PROJECT_ROOT, "data", "processed")
RESULTS_DIR = os.path.join(PROJECT_ROOT, "results")

RAW_ZIP_PATH = os.path.join(RAW_DIR, "extention_of_z_alizadeh_sani_dataset.zip")
EXCEL_FILENAME = "extention of Z-Alizadeh sani dataset.xlsx"
RAW_EXCEL_PATH = os.path.join(RAW_DIR, EXCEL_FILENAME)
PROCESSED_CSV_PATH = os.path.join(PROCESSED_DIR, "alizadeh_sani.csv")
AUDIT_JSON_PATH = os.path.join(RESULTS_DIR, "dataset_audit.json")

EXPECTED_TARGETS = {
    "Cath": {"CAD": 216, "Normal": 87},
    "LAD": {"Stenotic": 177, "Normal": 126},
    "LCX": {"Stenotic": 119, "Normal": 184},
    "RCA": {"Stenotic": 114, "Normal": 189},
}


def download_raw_dataset():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    os.makedirs(RESULTS_DIR, exist_ok=True)

    if not os.path.exists(RAW_ZIP_PATH):
        print(f"Downloading dataset from UCI repository: {UCI_DOWNLOAD_URL}...")
        urllib.request.urlretrieve(UCI_DOWNLOAD_URL, RAW_ZIP_PATH)
        print(f"Saved raw zip to {RAW_ZIP_PATH} ({os.path.getsize(RAW_ZIP_PATH)} bytes)")
    else:
        print(f"Raw zip already exists at {RAW_ZIP_PATH}")

    if not os.path.exists(RAW_EXCEL_PATH):
        print(f"Extracting {EXCEL_FILENAME}...")
        with zipfile.ZipFile(RAW_ZIP_PATH, "r") as zf:
            zf.extract(EXCEL_FILENAME, RAW_DIR)
        print(f"Extracted to {RAW_EXCEL_PATH}")
    else:
        print(f"Raw Excel file already exists at {RAW_EXCEL_PATH}")


def audit_and_process():
    print(f"Loading raw dataset from {RAW_EXCEL_PATH}...")
    df_raw = pd.read_excel(RAW_EXCEL_PATH)

    n_rows, n_cols = df_raw.shape
    print(f"Loaded shape: {n_rows} rows x {n_cols} columns")

    # 1. Structural Verification
    assert n_rows == 303, f"Expected 303 rows, got {n_rows}"
    assert n_cols == 59, f"Expected 59 columns, got {n_cols}"

    for target in EXPECTED_TARGETS.keys():
        assert target in df_raw.columns, f"Required target {target} not found in columns!"

    # 2. Target distributions
    target_distributions = {}
    target_verification_passed = True
    for target, expected_counts in EXPECTED_TARGETS.items():
        counts = df_raw[target].value_counts().to_dict()
        target_distributions[target] = counts
        print(f"Target '{target}': {counts} (Expected: {expected_counts})")
        if counts != expected_counts:
            target_verification_passed = False
            print(f"WARNING: Discrepancy in target {target}! Found {counts}, expected {expected_counts}")

    # 3. Clinical consistency audit between Cath and vessels
    cad_flags = (df_raw["Cath"] == "CAD")
    any_vessel_stenotic = (
        (df_raw["LAD"] == "Stenotic") |
        (df_raw["LCX"] == "Stenotic") |
        (df_raw["RCA"] == "Stenotic")
    )
    mismatch_mask = (cad_flags != any_vessel_stenotic)
    mismatch_indices = df_raw[mismatch_mask].index.tolist()
    mismatch_details = []
    for idx in mismatch_indices:
        row = df_raw.iloc[idx]
        mismatch_details.append({
            "dataset_row_index": int(idx),
            "patient_row_excel": int(idx + 2),  # 1-indexed header + 1
            "Cath": str(row["Cath"]),
            "LAD": str(row["LAD"]),
            "LCX": str(row["LCX"]),
            "RCA": str(row["RCA"]),
        })
    print(f"Clinical label consistency: {len(mismatch_indices)} mismatch(es) found: {mismatch_details}")

    # 4. Missing values & Duplicates
    missing_by_col = df_raw.isnull().sum().to_dict()
    total_missing = sum(missing_by_col.values())
    n_duplicates = int(df_raw.duplicated().sum())

    print(f"Total missing values: {total_missing}")
    print(f"Duplicate patient records: {n_duplicates}")

    # 5. Column profiling & Normalization
    df_processed = df_raw.copy()

    # Document categorical inconsistencies
    normalization_log = []
    # In Sex: normalize 'Fmale' -> 'Female'
    sex_counts_before = df_raw["Sex"].value_counts().to_dict()
    if "Fmale" in df_processed["Sex"].values:
        df_processed["Sex"] = df_processed["Sex"].replace({"Fmale": "Female"})
        normalization_log.append({
            "column": "Sex",
            "rule": "Replace 'Fmale' typo with 'Female'",
            "before": sex_counts_before,
            "after": df_processed["Sex"].value_counts().to_dict()
        })
        print(f"Normalized 'Sex': {normalization_log[-1]['after']}")

    # Check zero-variance features
    constant_columns = [col for col in df_processed.columns if df_processed[col].nunique() <= 1]
    print(f"Constant / Zero-variance columns identified: {constant_columns}")

    # Feature details summary
    feature_profiles = {}
    for col in df_processed.columns:
        s = df_processed[col]
        dtype_str = str(s.dtype)
        is_numeric = pd.api.types.is_numeric_dtype(s)
        n_unique = int(s.nunique())
        sample_vals = [str(x) for x in s.dropna().unique()[:6]]
        feature_profiles[col] = {
            "dtype": dtype_str,
            "is_numeric": is_numeric,
            "n_unique": n_unique,
            "sample_values": sample_vals,
            "missing_count": int(missing_by_col[col])
        }

    # Save processed CSV
    df_processed.to_csv(PROCESSED_CSV_PATH, index=False)
    print(f"Saved processed dataset to {PROCESSED_CSV_PATH}")

    # Write audit JSON
    audit_data = {
        "dataset_name": UCI_DATASET_NAME,
        "uci_id": UCI_DATASET_ID,
        "doi": DOI,
        "download_url": UCI_DOWNLOAD_URL,
        "raw_archive_path": os.path.relpath(RAW_ZIP_PATH, PROJECT_ROOT),
        "raw_excel_path": os.path.relpath(RAW_EXCEL_PATH, PROJECT_ROOT),
        "processed_csv_path": os.path.relpath(PROCESSED_CSV_PATH, PROJECT_ROOT),
        "shape": {"rows": n_rows, "columns": n_cols},
        "target_verification_passed": target_verification_passed,
        "target_distributions": target_distributions,
        "label_discrepancy_preserved": {
            "count": len(mismatch_indices),
            "note": "Row 94 discrepancy between Cath (Normal) and LAD (Stenotic) is preserved exactly as recorded in the clinical dataset.",
            "mismatches": mismatch_details
        },
        "data_quality": {
            "total_missing_values": total_missing,
            "missing_columns_count": sum(1 for v in missing_by_col.values() if v > 0),
            "duplicate_records": n_duplicates,
            "constant_columns": constant_columns
        },
        "normalization_applied": normalization_log,
        "feature_profiles": feature_profiles
    }

    with open(AUDIT_JSON_PATH, "w") as f:
        json.dump(audit_data, f, indent=2)
    print(f"Saved audit report to {AUDIT_JSON_PATH}")

    return audit_data


if __name__ == "__main__":
    download_raw_dataset()
    audit_and_process()
    print("Dataset download and audit complete successfully.")
