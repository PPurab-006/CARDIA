"""
Preprocessing and feature definition module for cardiovascular prediction.
Guarantees absolute target separation and leakage prevention.
"""

from typing import List, Tuple, Dict, Any
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.pipeline import Pipeline

TARGET_COLUMNS = ["Cath", "LAD", "LCX", "RCA"]

POSITIVE_LABELS = {
    "Cath": "CAD",
    "LAD": "Stenotic",
    "LCX": "Stenotic",
    "RCA": "Stenotic",
}

CONSTANT_COLUMNS_TO_DROP = ["Exertional CP"]

# Grouped feature definitions
NUMERIC_CONTINUOUS_FEATURES = [
    "Age", "Weight", "Length", "BMI", "BP", "PR",
    "FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB",
    "K", "Na", "WBC", "Lymph", "Neut", "PLT", "EF-TTE", "Region RWMA"
]

BINARY_INT_FEATURES = [
    "DM", "HTN", "Current Smoker", "EX-Smoker", "FH", "Edema",
    "Typical Chest Pain", "Q Wave", "St Elevation", "St Depression", "Tinversion"
]

ORDINAL_INT_FEATURES = [
    "Function Class"
]

BINARY_STR_YN_FEATURES = [
    "Obesity", "CRF", "CVA", "Airway disease", "Thyroid Disease",
    "CHF", "DLP", "Weak Peripheral Pulse", "Lung rales",
    "Systolic Murmur", "Diastolic Murmur", "Dyspnea", "Atypical",
    "Nonanginal", "LowTH Ang", "LVH", "Poor R Progression"
]

CATEGORICAL_MULTI_FEATURES = [
    "Sex", "BBB", "VHD"
]


def extract_features_and_target(
    df: pd.DataFrame, target_name: str
) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Extracts features matrix X and binary target vector y for a specific target.
    ENFORCES ABSOLUTE LEAKAGE EXCLUSION:
    Drops ALL target columns (Cath, LAD, LCX, RCA) and constant features.
    """
    if target_name not in TARGET_COLUMNS:
        raise ValueError(
            f"Invalid target '{target_name}'. Must be one of {TARGET_COLUMNS}."
        )

    # Clean Sex encoding if raw 'Fmale' present
    df_clean = df.copy()
    if "Sex" in df_clean.columns:
        df_clean["Sex"] = df_clean["Sex"].replace({"Fmale": "Female"})

    # Extract target vector
    raw_target = df_clean[target_name]
    pos_label = POSITIVE_LABELS[target_name]
    y = (raw_target == pos_label).astype(int)
    y.name = target_name

    # Strictly drop ALL target columns from X
    columns_to_exclude = list(TARGET_COLUMNS) + CONSTANT_COLUMNS_TO_DROP
    X = df_clean.drop(columns=[c for c in columns_to_exclude if c in df_clean.columns])

    # Guard assertion: absolutely none of the target columns may exist in X
    for forbidden in TARGET_COLUMNS:
        if forbidden in X.columns:
            raise RuntimeError(
                f"LEAKAGE SECURITY ALERT: Forbidden target '{forbidden}' detected in feature matrix X!"
            )

    return X, y


def build_preprocessor(feature_names: List[str]) -> ColumnTransformer:
    """
    Builds a leakage-free ColumnTransformer fitted only inside cross-validation folds.
    """
    # Select available features present in feature_names
    num_cont = [c for c in NUMERIC_CONTINUOUS_FEATURES if c in feature_names]
    bin_int = [c for c in BINARY_INT_FEATURES if c in feature_names]
    ord_int = [c for c in ORDINAL_INT_FEATURES if c in feature_names]
    bin_yn = [c for c in BINARY_STR_YN_FEATURES if c in feature_names]
    cat_multi = [c for c in CATEGORICAL_MULTI_FEATURES if c in feature_names]

    transformers = [
        ("num_scaler", StandardScaler(), num_cont),
        ("bin_scaler", "passthrough", bin_int),
        ("ord_scaler", StandardScaler(), ord_int),
        ("bin_yn_ohe", OneHotEncoder(drop="if_binary", handle_unknown="ignore", sparse_output=False), bin_yn),
        ("cat_multi_ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_multi),
    ]

    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="drop",
        verbose_feature_names_out=True
    )
    return preprocessor


def get_feature_schema(X: pd.DataFrame) -> Dict[str, Any]:
    """
    Generates a structured schema for input validation by the API and frontend.
    """
    schema = {
        "ordered_features": list(X.columns),
        "feature_count": len(X.columns),
        "features": {}
    }

    for col in X.columns:
        s = X[col]
        is_numeric = bool(pd.api.types.is_numeric_dtype(s))
        if is_numeric:
            schema["features"][col] = {
                "type": "numeric",
                "min": float(s.min()),
                "max": float(s.max()),
                "default": float(s.median()) if float(s.median()).is_integer() is False else int(s.median())
            }
        else:
            unique_vals = sorted([str(x) for x in s.dropna().unique()])
            schema["features"][col] = {
                "type": "categorical",
                "options": unique_vals,
                "default": str(s.mode().iloc[0]) if len(s.mode()) > 0 else unique_vals[0]
            }

    return schema
