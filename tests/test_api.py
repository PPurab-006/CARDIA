"""
Integration and security tests for the Cardiovascular Prediction Flask API.
Verifies health, schema, sample patients, strict target rejection, input validation,
error handling, probability bounds, and feature explanations.
"""

import json
import pytest
import numpy as np
import pandas as pd
from src.api.app import create_app
from src.ml.preprocess import TARGET_COLUMNS, CONSTANT_COLUMNS_TO_DROP

DATA_PATH = "data/processed/alizadeh_sani.csv"


@pytest.fixture
def client():
    app = create_app({"TESTING": True})
    with app.test_client() as client:
        yield client


@pytest.fixture
def valid_patient_payload():
    """Generates a valid clinical input payload using row 0 from the processed dataset."""
    df = pd.read_csv(DATA_PATH)
    row = df.drop(columns=TARGET_COLUMNS + CONSTANT_COLUMNS_TO_DROP).iloc[0].to_dict()
    # Convert numpy types to native Python types
    clean_row = {}
    for k, v in row.items():
        if pd.isna(v):
            continue
        if isinstance(v, (np.integer, int)):
            clean_row[k] = int(v)
        elif isinstance(v, (np.floating, float)):
            clean_row[k] = float(v)
        else:
            clean_row[k] = str(v)
    return clean_row


def test_health_endpoint(client):
    """Verify /api/health returns 200 and reports all 4 loaded models."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "healthy"
    assert "models_loaded" in data
    assert set(data["models_loaded"].keys()) == {"CAD", "LAD", "LCX", "RCA"}
    assert data["feature_count"] == 54


def test_schema_endpoint(client):
    """Verify /api/schema returns target definitions and 54 ordered features."""
    res = client.get("/api/schema")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert data["feature_count"] == 54
    assert len(data["ordered_features"]) == 54
    for target in ["CAD", "LAD", "LCX", "RCA"]:
        assert target in data["targets"]


def test_sample_patients_endpoint(client):
    """Verify /api/sample-patients returns labeled illustrative synthetic profiles."""
    res = client.get("/api/sample-patients")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "success"
    assert "synthetic_notice" in data
    assert len(data["samples"]) >= 3
    for sample in data["samples"]:
        assert "id" in sample
        assert "profile" in sample
        assert len(sample["profile"]) == 54


def test_valid_prediction(client, valid_patient_payload):
    """Verify /api/predict produces calibrated probabilities and 3D colormaps for all 4 targets."""
    res = client.post("/api/predict", json=valid_patient_payload)
    assert res.status_code == 200
    data = res.get_json()

    assert data["status"] == "success"
    assert "predictions" in data
    assert set(data["predictions"].keys()) == {"CAD", "LAD", "LCX", "RCA"}

    for target in ["CAD", "LAD", "LCX", "RCA"]:
        pred = data["predictions"][target]
        assert "probability" in pred
        assert 0.0 <= pred["probability"] <= 1.0
        assert not np.isnan(pred["probability"])
        assert pred["predicted_class"] in [0, 1]
        assert pred["risk_level"] in ["Low", "Moderate", "High"]
        assert pred["color_hex"].startswith("#")

    # Colormap verification for 3D vascular visualization
    assert "vessel_colormap" in data
    assert set(data["vessel_colormap"].keys()) == {"LAD", "LCX", "RCA"}

    # Feature explanation verification
    assert "explanations" in data
    assert "CAD" in data["explanations"]
    assert len(data["explanations"]["CAD"]) > 0

    # Disclaimer check
    assert "disclaimer" in data
    assert "Educational and decision-support prototype only" in data["disclaimer"]


@pytest.mark.parametrize("forbidden_col", ["Cath", "LAD", "LCX", "RCA", "cath", "cad", "CAD"])
def test_target_leakage_rejection(client, valid_patient_payload, forbidden_col):
    """
    CRITICAL SECURITY & LEAKAGE TEST:
    Assert that the API strictly rejects any request payload containing target columns.
    """
    poisoned_payload = valid_patient_payload.copy()
    poisoned_payload[forbidden_col] = 1

    res = client.post("/api/predict", json=poisoned_payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data["status"] == "error"
    assert "Direct target leakage rejected" in data["message"]


def test_missing_fields_rejection(client, valid_patient_payload):
    """Verify 400 response when required clinical fields are omitted."""
    incomplete = valid_patient_payload.copy()
    del incomplete["Age"]
    del incomplete["Typical Chest Pain"]

    res = client.post("/api/predict", json=incomplete)
    assert res.status_code == 400
    data = res.get_json()
    assert data["status"] == "error"
    assert "Missing required fields" in data["message"]


def test_invalid_categorical_value(client, valid_patient_payload):
    """Verify 400 response when categorical value is outside permitted options."""
    bad_payload = valid_patient_payload.copy()
    bad_payload["Sex"] = "UnknownGender"

    res = client.post("/api/predict", json=bad_payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data["status"] == "error"
    assert "invalid" in data["message"]


def test_nan_and_infinity_rejection(client, valid_patient_payload):
    """Verify rejection of NaN, Inf, and non-numeric values in numeric fields."""
    # Test NaN string or non-numeric
    bad_num = valid_patient_payload.copy()
    bad_num["Age"] = "NotANumber"
    res = client.post("/api/predict", json=bad_num)
    assert res.status_code == 400

    # Test extreme out of bounds
    out_of_bounds = valid_patient_payload.copy()
    out_of_bounds["Age"] = 180  # Max human age in schema is 86
    res2 = client.post("/api/predict", json=out_of_bounds)
    assert res2.status_code == 400
    data2 = res2.get_json()
    assert "outside clinical boundary" in data2["message"]


def test_malformed_json_and_non_json_content(client):
    """Verify 400 response for non-JSON requests."""
    res = client.post("/api/predict", data="plain text data", content_type="text/plain")
    assert res.status_code == 400
    assert "Content-Type must be application/json" in res.get_json()["message"]


def test_prediction_probabilities_bounded_and_consistent(client):
    """
    Test multiple synthetic sample patient profiles and verify all probabilities
    are strictly bounded in [0, 1] with valid JSON formatting.
    """
    samples_res = client.get("/api/sample-patients")
    samples_data = samples_res.get_json()

    for item in samples_data["samples"]:
        profile = item["profile"]
        res = client.post("/api/predict", json=profile)
        assert res.status_code == 200
        data = res.get_json()

        for target in ["CAD", "LAD", "LCX", "RCA"]:
            p = data["predictions"][target]["probability"]
            assert isinstance(p, float)
            assert 0.0 <= p <= 1.0
