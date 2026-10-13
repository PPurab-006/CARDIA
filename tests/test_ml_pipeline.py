"""
Unit and integration tests for cardiovascular risk prediction ML pipeline.
Verifies absolute target leakage prevention, artifact integrity, and inference probability bounds.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.pipeline import Pipeline

from src.ml.preprocess import (
    TARGET_COLUMNS,
    extract_features_and_target,
    CONSTANT_COLUMNS_TO_DROP
)
from src.ml.explain import compute_local_explanation

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, "data", "processed", "alizadeh_sani.csv")
MODELS_DIR = os.path.join(PROJECT_ROOT, "artifacts", "models")
METRICS_DIR = os.path.join(PROJECT_ROOT, "results", "metrics")


@pytest.fixture(scope="module")
def processed_df():
    assert os.path.exists(DATA_PATH), f"Processed data not found at {DATA_PATH}"
    df = pd.read_csv(DATA_PATH)
    assert len(df) == 303, f"Expected 303 rows, got {len(df)}"
    return df


def test_leakage_exclusion_rules(processed_df):
    """
    CRITICAL SAFEGUARD TEST:
    Assert that none of Cath, LAD, LCX, RCA are present in the feature matrix X
    for ANY target extraction call.
    """
    for target in TARGET_COLUMNS:
        X, y = extract_features_and_target(processed_df, target)

        # None of the targets can ever be in X
        for forbidden in TARGET_COLUMNS:
            assert forbidden not in X.columns, (
                f"LEAKAGE VIOLATION: Forbidden column '{forbidden}' found in feature matrix for target '{target}'!"
            )

        # Target column count check (59 original - 4 targets - 1 constant = 54 features)
        assert len(X.columns) == 54, f"Expected 54 features after exclusions, got {len(X.columns)}"
        assert len(X) == len(y) == 303, "Row count mismatch between features and target"
        assert set(y.unique()).issubset({0, 1}), f"Target '{target}' must be binary 0/1"


def test_constant_features_dropped(processed_df):
    """
    Verify zero-variance constant features (like Exertional CP) are removed.
    """
    for target in TARGET_COLUMNS:
        X, _ = extract_features_and_target(processed_df, target)
        for const_col in CONSTANT_COLUMNS_TO_DROP:
            assert const_col not in X.columns, f"Constant feature '{const_col}' was not dropped!"


def test_model_artifacts_integrity():
    """
    Verify all 4 trained target pipelines exist and can be loaded in memory.
    """
    expected_models = ["cath_pipeline.joblib", "lad_pipeline.joblib", "lcx_pipeline.joblib", "rca_pipeline.joblib"]
    for model_file in expected_models:
        path = os.path.join(MODELS_DIR, model_file)
        assert os.path.exists(path), f"Expected model artifact missing: {path}"
        pipeline = joblib.load(path)
        assert isinstance(pipeline, Pipeline), f"Artifact {model_file} is not a valid Pipeline"
        assert "preprocessor" in pipeline.named_steps
        assert "classifier" in pipeline.named_steps


def test_sample_inference_probabilities(processed_df):
    """
    Runs end-to-end inference on sample patients for all 4 targets.
    Proves all probabilities are finite, non-null, and within [0, 1].
    """
    # Create sample patient without target columns
    sample_patient = processed_df.drop(columns=TARGET_COLUMNS + CONSTANT_COLUMNS_TO_DROP).iloc[[0]]

    target_models = {
        "Cath": "cath_pipeline.joblib",
        "LAD": "lad_pipeline.joblib",
        "LCX": "lcx_pipeline.joblib",
        "RCA": "rca_pipeline.joblib"
    }

    for target_name, model_file in target_models.items():
        pipeline_path = os.path.join(MODELS_DIR, model_file)
        pipeline = joblib.load(pipeline_path)

        probas = pipeline.predict_proba(sample_patient)
        assert probas.shape == (1, 2), f"Expected shape (1, 2), got {probas.shape}"

        p0, p1 = float(probas[0, 0]), float(probas[0, 1])
        assert not np.isnan(p0) and not np.isnan(p1), f"NaN probability detected for {target_name}"
        assert not np.isinf(p0) and not np.isinf(p1), f"Infinite probability detected for {target_name}"
        assert 0.0 <= p0 <= 1.0, f"p0 out of bounds for {target_name}: {p0}"
        assert 0.0 <= p1 <= 1.0, f"p1 out of bounds for {target_name}: {p1}"
        assert abs((p0 + p1) - 1.0) < 1e-5, f"Probabilities do not sum to 1 for {target_name}: {p0 + p1}"


def test_feature_schema_exists():
    """
    Verify feature_schema.json exists and specifies 54 features.
    """
    schema_path = os.path.join(MODELS_DIR, "feature_schema.json")
    assert os.path.exists(schema_path), f"Missing feature schema at {schema_path}"
    with open(schema_path, "r") as f:
        schema = json.load(f)
    assert "ordered_features" in schema
    assert len(schema["ordered_features"]) == 54
    assert "features" in schema
    for forbidden in TARGET_COLUMNS:
        assert forbidden not in schema["ordered_features"]


def test_local_explanation_works(processed_df):
    """
    Verify local explanation returns valid ranked features with contributions.
    """
    X_sample = processed_df.drop(columns=TARGET_COLUMNS + CONSTANT_COLUMNS_TO_DROP)
    patient = X_sample.iloc[[0]]

    pipeline = joblib.load(os.path.join(MODELS_DIR, "cath_pipeline.joblib"))
    explanations = compute_local_explanation(pipeline, patient, X_sample, top_n=5)

    assert len(explanations) == 5, f"Expected 5 explanations, got {len(explanations)}"
    for item in explanations:
        assert "feature" in item
        assert "contribution_score" in item
        assert "direction" in item
        assert not np.isnan(item["contribution_score"])
