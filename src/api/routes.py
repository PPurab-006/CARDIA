"""
Flask routes and request handlers for Cardiovascular Risk Prediction API.
Implements strict schema validation, target column rejection, multi-target inference,
vessel-specific 3D colormaps, and patient-level explanations.
"""

import json
import math
import os
from typing import Dict, Any, List, Tuple
import joblib
import numpy as np
import pandas as pd
from flask import Blueprint, jsonify, request, current_app

from src.ml.explain import compute_local_explanation

api_bp = Blueprint("api", __name__)

FORBIDDEN_TARGET_FIELDS = {
    "cath", "lad", "lcx", "rca", "cad"
}

DISCLAIMER_TEXT = (
    "Educational and decision-support prototype only. "
    "Predictions are not a diagnosis and must not replace professional medical evaluation "
    "or formal diagnostic imaging."
)

COLORMAP_THRESHOLDS = {
    "low": {"max": 0.30, "color": "#10b981", "label": "Low Stenosis Likelihood"},
    "moderate": {"max": 0.60, "color": "#f59e0b", "label": "Moderate Stenosis Likelihood"},
    "high": {"max": 1.00, "color": "#ef4444", "label": "High Stenosis Likelihood"},
}


def get_risk_meta(prob: float) -> Tuple[str, str, str]:
    """Returns (risk_level, color_hex, risk_label)."""
    if prob < COLORMAP_THRESHOLDS["low"]["max"]:
        return "Low", COLORMAP_THRESHOLDS["low"]["color"], COLORMAP_THRESHOLDS["low"]["label"]
    elif prob <= COLORMAP_THRESHOLDS["moderate"]["max"]:
        return "Moderate", COLORMAP_THRESHOLDS["moderate"]["color"], COLORMAP_THRESHOLDS["moderate"]["label"]
    else:
        return "High", COLORMAP_THRESHOLDS["high"]["color"], COLORMAP_THRESHOLDS["high"]["label"]


class ModelRegistry:
    """Manages loaded pipelines, feature schema, and reference background data."""
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.models_dir = os.path.join(base_dir, "artifacts", "models")
        self.metrics_dir = os.path.join(base_dir, "results", "metrics")
        self.data_dir = os.path.join(base_dir, "data", "processed")

        self.models: Dict[str, Any] = {}
        self.schema: Dict[str, Any] = {}
        self.feature_importances: Dict[str, Any] = {}
        self.selected_metrics: Dict[str, Any] = {}
        self.background_df: pd.DataFrame = None

        self.load_all()

    def load_all(self):
        # 1. Load pipelines
        pipeline_map = {
            "CAD": "cath_pipeline.joblib",
            "LAD": "lad_pipeline.joblib",
            "LCX": "lcx_pipeline.joblib",
            "RCA": "rca_pipeline.joblib"
        }
        for target, filename in pipeline_map.items():
            path = os.path.join(self.models_dir, filename)
            if not os.path.exists(path):
                raise FileNotFoundError(f"Model artifact {filename} not found at {path}")
            self.models[target] = joblib.load(path)

        # 2. Load schema
        schema_path = os.path.join(self.models_dir, "feature_schema.json")
        if not os.path.exists(schema_path):
            raise FileNotFoundError(f"Feature schema not found at {schema_path}")
        with open(schema_path, "r") as f:
            self.schema = json.load(f)

        # 3. Load global importances
        imp_path = os.path.join(self.models_dir, "feature_importances.json")
        if os.path.exists(imp_path):
            with open(imp_path, "r") as f:
                self.feature_importances = json.load(f)

        # 4. Load selected metrics
        met_path = os.path.join(self.metrics_dir, "selected_model_metrics.json")
        if os.path.exists(met_path):
            with open(met_path, "r") as f:
                self.selected_metrics = json.load(f)

        # 5. Load background data for explanations
        data_path = os.path.join(self.data_dir, "alizadeh_sani.csv")
        if os.path.exists(data_path):
            df = pd.read_csv(data_path)
            # Retain only model features
            cols = [c for c in self.schema["ordered_features"] if c in df.columns]
            self.background_df = df[cols]


_registry = None

def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        _registry = ModelRegistry(project_root)
    return _registry


@api_bp.route("/health", methods=["GET"])
def health_check():
    """Health status and model readiness."""
    try:
        reg = get_registry()
        models_status = {
            target: type(pipe.named_steps["classifier"]).__name__
            for target, pipe in reg.models.items()
        }
        return jsonify({
            "status": "healthy",
            "service": "Cardiovascular Risk Prediction API",
            "version": "1.0.0",
            "models_loaded": models_status,
            "feature_count": reg.schema.get("feature_count", 54),
            "dataset_provenance": {
                "dataset": "Extension of Z-Alizadeh Sani Dataset",
                "uci_id": 411,
                "doi": "10.24432/C5461K",
                "sample_size": 303
            }
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error_code": "MODEL_LOAD_ERROR",
            "message": "Model artifacts could not be loaded."
        }), 500


@api_bp.route("/schema", methods=["GET"])
def get_schema():
    """Exposes input schema, data types, acceptable bounds, and target definitions."""
    reg = get_registry()
    return jsonify({
        "status": "success",
        "targets": {
            "CAD": "Overall Coronary Artery Disease Status (Cath)",
            "LAD": "Left Anterior Descending Artery Stenosis (>=50%)",
            "LCX": "Left Circumflex Artery Stenosis (>=50%)",
            "RCA": "Right Coronary Artery Stenosis (>=50%)"
        },
        "feature_count": reg.schema["feature_count"],
        "ordered_features": reg.schema["ordered_features"],
        "features": reg.schema["features"]
    }), 200


@api_bp.route("/metrics", methods=["GET"])
def get_metrics():
    """Returns cross-validated performance metrics for all four selected target models."""
    reg = get_registry()
    return jsonify({
        "status": "success",
        "validation_method": "Stratified 5-Fold Cross-Validation (Inside-Fold Fitting)",
        "cohort_size": 303,
        "metrics": reg.selected_metrics
    }), 200


@api_bp.route("/sample-patients", methods=["GET"])
def get_sample_patients():
    """Returns illustrative synthetic patient profiles for prototyping."""
    reg = get_registry()
    ordered = reg.schema["ordered_features"]
    features_meta = reg.schema["features"]

    # Baseline default patient
    baseline = {}
    for f in ordered:
        baseline[f] = features_meta[f]["default"]

    # Profile 1: High Multi-Vessel Risk (Illustrative Synthetic)
    high_risk = baseline.copy()
    high_risk.update({
        "Age": 68,
        "Sex": "Male",
        "DM": 1,
        "HTN": 1,
        "Current Smoker": 1,
        "Typical Chest Pain": 1,
        "St Depression": 1,
        "Tinversion": 1,
        "BP": 150,
        "FBS": 185,
        "TG": 260,
        "LDL": 160,
        "HDL": 32,
        "EF-TTE": 35,
        "Region RWMA": 2
    })

    # Profile 2: Low Risk / Normal Control (Illustrative Synthetic)
    low_risk = baseline.copy()
    low_risk.update({
        "Age": 45,
        "Sex": "Female",
        "DM": 0,
        "HTN": 0,
        "Current Smoker": 0,
        "Typical Chest Pain": 0,
        "St Depression": 0,
        "Tinversion": 0,
        "BP": 115,
        "PR": 72,
        "FBS": 88,
        "TG": 110,
        "LDL": 90,
        "HDL": 58,
        "EF-TTE": 55,
        "Region RWMA": 0
    })

    # Profile 3: Isolated Vessel / Moderate Risk (Illustrative Synthetic)
    mod_risk = baseline.copy()
    mod_risk.update({
        "Age": 57,
        "Sex": "Male",
        "DM": 1,
        "HTN": 1,
        "Current Smoker": 0,
        "Typical Chest Pain": 1,
        "St Depression": 0,
        "Tinversion": 0,
        "BP": 130,
        "FBS": 140,
        "TG": 180,
        "EF-TTE": 50,
        "Region RWMA": 0
    })

    # Profile 4: Young Adult / Extrapolation Boundary Test (Illustrative Synthetic)
    young_adult = baseline.copy()
    young_adult.update({
        "Age": 20,
        "Sex": "Male",
        "DM": 0,
        "HTN": 0,
        "Current Smoker": 0,
        "Typical Chest Pain": 0,
        "BP": 120,
        "PR": 70,
        "FBS": 90,
        "TG": 120,
        "LDL": 100,
        "HDL": 50,
        "EF-TTE": 60,
        "Region RWMA": 0
    })

    return jsonify({
        "status": "success",
        "synthetic_notice": (
            "Illustrative synthetic patient profiles for demonstration and testing only. "
            "Never represent synthetic examples as real clinical patients."
        ),
        "samples": [
            {
                "id": "high_multivessel_risk",
                "label": "Illustrative Profile 1: High Multi-Vessel Risk",
                "summary": "68yo Male, Diabetic, Smoker, ST depression, low EF (35%), regional wall motion abnormality.",
                "profile": high_risk
            },
            {
                "id": "low_risk_control",
                "label": "Illustrative Profile 2: Low Cardiovascular Risk Control",
                "summary": "45yo Female, Non-smoker, normal glucose, normal lipids, normal ECG and normal echocardiogram.",
                "profile": low_risk
            },
            {
                "id": "moderate_risk_angina",
                "label": "Illustrative Profile 3: Moderate Risk with Angina",
                "summary": "57yo Male, Diabetic, hypertensive, typical chest pain, preserved ejection fraction (50%).",
                "profile": mod_risk
            },
            {
                "id": "young_adult_extrapolation",
                "label": "Illustrative Profile 4: Young Adult (Age 20 Extrapolation Test)",
                "summary": "20yo Male, Non-smoker, normal vitals — demonstrates out-of-cohort extrapolation handling (18–29 yrs).",
                "profile": young_adult
            }
        ]
    }), 200


def validate_prediction_payload(payload: Any, schema: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    """
    Validates input payload against schema rules:
    - Rejects forbidden targets
    - Checks required features
    - Checks types, finite values, and bounds
    Returns (cleaned_data, error_message). If error_message is not None, validation failed.
    """
    if not isinstance(payload, dict):
        return None, "Request payload must be a JSON object."

    # 1. STRICT TARGET REJECTION
    for k in payload.keys():
        if k.lower() in FORBIDDEN_TARGET_FIELDS:
            return None, (
                f"Direct target leakage rejected: Forbidden target field '{k}' "
                "cannot be submitted in prediction payload."
            )

    ordered = schema["ordered_features"]
    features_meta = schema["features"]
    cleaned = {}

    # 2. Check for missing and invalid fields
    missing_fields = []
    for f in ordered:
        if f not in payload:
            missing_fields.append(f)
    if missing_fields:
        return None, f"Missing required fields: {missing_fields[:5]}" + (f" and {len(missing_fields)-5} more." if len(missing_fields) > 5 else ".")

    for f in ordered:
        val = payload[f]
        meta = features_meta[f]

        if meta["type"] == "numeric":
            try:
                num_val = float(val)
            except (ValueError, TypeError):
                return None, f"Field '{f}' must be a valid numeric value, got '{val}'."

            if math.isnan(num_val) or math.isinf(num_val):
                return None, f"Field '{f}' contains non-finite numeric value (NaN or Infinity)."

            if f == "Age":
                app_min = float(meta.get("min", 18.0))
                app_max = float(meta.get("max", 100.0))
                if num_val < app_min or num_val > app_max:
                    return None, f"Field 'Age' value {num_val} is outside allowed boundary [{int(app_min)}, {int(app_max)}]."
            else:
                # Enforce documented bounds with reasonable tolerance
                min_val = meta["min"]
                max_val = meta["max"]
                # Apply 15% clinical tolerance for continuous variables to avoid rejecting realistic edge cases
                tol_min = min_val * 0.85 if min_val > 0 else min_val * 1.15
                tol_max = max_val * 1.15

                if num_val < tol_min or num_val > tol_max:
                    return None, f"Field '{f}' value {num_val} is outside clinical boundary [{min_val}, {max_val}]."

            cleaned[f] = num_val

        elif meta["type"] == "categorical":
            str_val = str(val).strip()
            # Normalize 'Fmale' if user submitted it
            if f == "Sex" and str_val.lower() == "fmale":
                str_val = "Female"

            allowed = meta["options"]
            if str_val not in allowed:
                return None, f"Field '{f}' value '{val}' is invalid. Allowed options: {allowed}."

            cleaned[f] = str_val

    return cleaned, None


@api_bp.route("/predict", methods=["POST"])
def predict():
    """
    Main prediction endpoint.
    Accepts clinical inputs, computes probabilities for CAD, LAD, LCX, RCA,
    generates 3D color mappings, and returns feature explanations.
    """
    reg = get_registry()

    if not request.is_json:
        return jsonify({
            "status": "error",
            "error_code": "INVALID_CONTENT_TYPE",
            "message": "Content-Type must be application/json."
        }), 400

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({
            "status": "error",
            "error_code": "MALFORMED_JSON",
            "message": "Malformed JSON in request body."
        }), 400

    cleaned_data, error_msg = validate_prediction_payload(payload, reg.schema)
    if error_msg is not None:
        return jsonify({
            "status": "error",
            "error_code": "VALIDATION_ERROR",
            "message": error_msg
        }), 400

    try:
        # Build DataFrame with strictly ordered features
        ordered_features = reg.schema["ordered_features"]
        df_patient = pd.DataFrame([cleaned_data])[ordered_features]

        predictions = {}
        for target, pipeline in reg.models.items():
            classifier = pipeline.named_steps["classifier"]
            # Dynamically look up positive class index
            pos_idx = list(classifier.classes_).index(1) if hasattr(classifier, "classes_") else 1
            prob = float(pipeline.predict_proba(df_patient)[0, pos_idx])
            pred_class = int(prob >= 0.5)

            risk_level, color_hex, risk_label = get_risk_meta(prob)
            model_type = type(classifier).__name__

            target_internal = "Cath" if target == "CAD" else target
            cv_auc = None
            if target_internal in reg.selected_metrics:
                cv_auc = reg.selected_metrics[target_internal]["metrics"].get("roc_auc")

            predictions[target] = {
                "probability": round(prob, 4),
                "predicted_class": pred_class,
                "risk_level": risk_level,
                "color_hex": color_hex,
                "risk_label": risk_label,
                "model_architecture": model_type,
                "cv_roc_auc": cv_auc
            }

        # 3D Vessel Visualization Map
        vessel_colormap = {
            "LAD": {
                "name": "Left Anterior Descending",
                "probability": predictions["LAD"]["probability"],
                "risk_level": predictions["LAD"]["risk_level"],
                "color_hex": predictions["LAD"]["color_hex"]
            },
            "LCX": {
                "name": "Left Circumflex",
                "probability": predictions["LCX"]["probability"],
                "risk_level": predictions["LCX"]["risk_level"],
                "color_hex": predictions["LCX"]["color_hex"]
            },
            "RCA": {
                "name": "Right Coronary Artery",
                "probability": predictions["RCA"]["probability"],
                "risk_level": predictions["RCA"]["risk_level"],
                "color_hex": predictions["RCA"]["color_hex"]
            }
        }

        # Compute local feature attributions for CAD
        cad_pipeline = reg.models["CAD"]
        explanations = {}
        if reg.background_df is not None:
            explanations["CAD"] = compute_local_explanation(
                cad_pipeline, df_patient, reg.background_df, top_n=6
            )
            explanations["LAD"] = compute_local_explanation(
                reg.models["LAD"], df_patient, reg.background_df, top_n=6
            )
            explanations["LCX"] = compute_local_explanation(
                reg.models["LCX"], df_patient, reg.background_df, top_n=6
            )
            explanations["RCA"] = compute_local_explanation(
                reg.models["RCA"], df_patient, reg.background_df, top_n=6
            )

        # Check for non-blocking clinical warnings (e.g. out-of-cohort extrapolation)
        warnings = []
        age_val = float(cleaned_data.get("Age", 58))
        if (18 <= age_val < 30) or (86 < age_val <= 100):
            warnings.append(
                f"Patient Age ({int(age_val)}) lies outside the observed training cohort (30–86 yrs). "
                "Predictions are extrapolated and should be interpreted with clinical caution."
            )

        return jsonify({
            "status": "success",
            "predictions": predictions,
            "vessel_colormap": vessel_colormap,
            "explanations": explanations,
            "global_top_features": {
                target: list(reg.feature_importances.get("Cath" if target == "CAD" else target, {}).keys())[:5]
                for target in reg.models.keys()
            },
            "warnings": warnings,
            "disclaimer": DISCLAIMER_TEXT
        }), 200

    except Exception as e:
        # Avoid leaking filesystem paths or tracebacks to client
        return jsonify({
            "status": "error",
            "error_code": "PREDICTION_PROCESSING_ERROR",
            "message": "An error occurred while computing predictions."
        }), 500
