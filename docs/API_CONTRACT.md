# Cardiovascular Risk Prediction API Contract
**Track A: Cardiovascular Risk Visualization & Prediction**  
**Version:** 1.0.0-prototype  
**Base URL:** `http://localhost:5000/api`

---

## 1. Overview & Disclaimer

This API serves calibrated prediction probabilities for overall Coronary Artery Disease (CAD) and vessel-specific stenosis ($\ge 50\%$) for the **Left Anterior Descending (LAD)**, **Left Circumflex (LCX)**, and **Right Coronary Artery (RCA)**.

> [!IMPORTANT]
> **Mandatory Medical Disclaimer:**  
> "Educational and decision-support prototype only. Predictions are not a diagnosis and must not replace professional medical evaluation or formal diagnostic imaging."

All models are trained strictly without target leakage on the 303-patient Extension of Z-Alizadeh Sani dataset (UCI ID 411). The input schema strictly requires clinical, exam, ECG, and echocardiographic features. Angiographic outcomes (`Cath`, `LAD`, `LCX`, `RCA`) are never accepted as model inputs.

---

## 2. API Endpoints

### 2.1 Health & Metadata: `GET /api/health`
Checks server readiness and loaded model states.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "models_loaded": {
    "CAD": "RandomForest",
    "LAD": "GradientBoosting",
    "LCX": "RandomForest",
    "RCA": "LogisticRegression"
  },
  "dataset_provenance": {
    "source": "UCI Machine Learning Repository ID 411",
    "doi": "10.24432/C5461K",
    "training_samples": 303
  }
}
```

---

### 2.2 Feature Schema: `GET /api/schema`
Supplies full feature definitions, validation bounds, defaults, and categorical levels for UI form generation.

**Response:** `200 OK`
```json
{
  "feature_count": 54,
  "ordered_features": [
    "Age", "Weight", "Length", "Sex", "BMI", "DM", "HTN", "Current Smoker",
    "EX-Smoker", "FH", "Obesity", "CRF", "CVA", "Airway disease", "Thyroid Disease",
    "CHF", "DLP", "BP", "PR", "Edema", "Weak Peripheral Pulse", "Lung rales",
    "Systolic Murmur", "Diastolic Murmur", "Typical Chest Pain", "Dyspnea",
    "Function Class", "Atypical", "Nonanginal", "LowTH Ang", "Q Wave",
    "St Elevation", "St Depression", "Tinversion", "LVH", "Poor R Progression",
    "BBB", "FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na",
    "WBC", "Lymph", "Neut", "PLT", "EF-TTE", "Region RWMA", "VHD"
  ],
  "features": {
    "Age": { "type": "numeric", "min": 30.0, "max": 86.0, "default": 58 },
    "Sex": { "type": "categorical", "options": ["Female", "Male"], "default": "Male" },
    "BP": { "type": "numeric", "min": 90.0, "max": 190.0, "default": 130 },
    "VHD": { "type": "categorical", "options": ["N", "mild", "Moderate", "Severe"], "default": "N" },
    "BBB": { "type": "categorical", "options": ["N", "LBBB", "RBBB"], "default": "N" }
  }
}
```

---

### 2.3 Sample Illustrative Patients: `GET /api/sample-patients`
Returns pre-populated demo patient profiles (illustrative/synthetic) for 1-click clinical testing.

**Response:** `200 OK`
```json
{
  "samples": [
    {
      "id": "high_risk_cad_lad",
      "name": "Illustrative Patient 1: High Multi-Vessel Risk",
      "description": "64yo male, diabetic, smoker, resting ST depression and reduced ejection fraction (35%).",
      "data": { "Age": 64, "Sex": "Male", "DM": 1, "Current Smoker": 1, "EF-TTE": 35, "Region RWMA": 2 }
    },
    {
      "id": "low_risk_control",
      "name": "Illustrative Patient 2: Low Cardiovascular Risk",
      "description": "48yo female, normotensive, non-smoker, normal ECG and normal echocardiogram (EF 55%).",
      "data": { "Age": 48, "Sex": "Female", "DM": 0, "Current Smoker": 0, "EF-TTE": 55, "Region RWMA": 0 }
    }
  ]
}
```

---

### 2.4 Predict Cardiovascular Risk: `POST /api/predict`
Calculates calibrated probabilities for overall CAD and LAD/LCX/RCA vessels, generates 3D color mappings, and returns feature attributions.

**Request Headers:** `Content-Type: application/json`

**Request Body:**
```json
{
  "Age": 62,
  "Weight": 80,
  "Length": 172,
  "Sex": "Male",
  "BMI": 27.04,
  "DM": 1,
  "HTN": 1,
  "Current Smoker": 1,
  "EX-Smoker": 0,
  "FH": 1,
  "Obesity": "Y",
  "CRF": "N",
  "CVA": "N",
  "Airway disease": "N",
  "Thyroid Disease": "N",
  "CHF": "N",
  "DLP": "Y",
  "BP": 140,
  "PR": 78,
  "Edema": 0,
  "Weak Peripheral Pulse": "N",
  "Lung rales": "N",
  "Systolic Murmur": "N",
  "Diastolic Murmur": "N",
  "Typical Chest Pain": 1,
  "Dyspnea": "N",
  "Function Class": 1,
  "Atypical": "N",
  "Nonanginal": "N",
  "LowTH Ang": "N",
  "Q Wave": 0,
  "St Elevation": 0,
  "St Depression": 1,
  "Tinversion": 1,
  "LVH": "N",
  "Poor R Progression": "N",
  "BBB": "N",
  "FBS": 140,
  "CR": 1.1,
  "TG": 220,
  "LDL": 145,
  "HDL": 38,
  "BUN": 19,
  "ESR": 24,
  "HB": 14.2,
  "K": 4.3,
  "Na": 140,
  "WBC": 7200,
  "Lymph": 32,
  "Neut": 60,
  "PLT": 230,
  "EF-TTE": 45,
  "Region RWMA": 1,
  "VHD": "N"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "predictions": {
    "CAD": {
      "probability": 0.8415,
      "risk_level": "High",
      "model": "RandomForest",
      "cv_roc_auc": 0.9285
    },
    "LAD": {
      "probability": 0.7620,
      "risk_level": "High",
      "model": "GradientBoosting",
      "cv_roc_auc": 0.8365
    },
    "LCX": {
      "probability": 0.3812,
      "risk_level": "Moderate",
      "model": "RandomForest",
      "cv_roc_auc": 0.7132
    },
    "RCA": {
      "probability": 0.4530,
      "risk_level": "Moderate",
      "model": "LogisticRegression",
      "cv_roc_auc": 0.7094
    }
  },
  "visualization_colormap": {
    "LAD": {
      "vessel_name": "Left Anterior Descending",
      "probability": 0.762,
      "color_hex": "#ef4444",
      "risk_label": "High Stenosis Probability"
    },
    "LCX": {
      "vessel_name": "Left Circumflex",
      "probability": 0.3812,
      "color_hex": "#f59e0b",
      "risk_label": "Moderate Stenosis Probability"
    },
    "RCA": {
      "vessel_name": "Right Coronary Artery",
      "probability": 0.453,
      "color_hex": "#f59e0b",
      "risk_label": "Moderate Stenosis Probability"
    }
  },
  "explanations": {
    "CAD": [
      {
        "feature": "Typical Chest Pain",
        "contribution_score": 0.142,
        "direction": "increases_risk",
        "patient_value": "1"
      },
      {
        "feature": "Region RWMA",
        "contribution_score": 0.089,
        "direction": "increases_risk",
        "patient_value": "1"
      },
      {
        "feature": "Age",
        "contribution_score": 0.065,
        "direction": "increases_risk",
        "patient_value": "62"
      }
    ]
  },
  "disclaimer": "Educational and decision-support prototype only. Predictions are not a diagnosis and must not replace professional medical evaluation or formal diagnostic imaging."
}
```

---

## 3. Risk Thresholds & 3D Color Map

| Probability Range | Risk Category | Hex Color | Interpretation |
| :--- | :--- | :--- | :--- |
| **0.00 – 0.30** | Low Risk | `#10b981` (Emerald Green) | Normal baseline; low predicted stenosis likelihood |
| **0.31 – 0.60** | Moderate Risk | `#f59e0b` (Amber Orange) | Borderline / elevated risk; monitoring recommended |
| **0.61 – 1.00** | High Risk | `#ef4444` (Crimson Red) | High predicted stenosis likelihood |

---

## 4. Error Responses

* **`400 Bad Request`**: Missing required features, invalid data types, or out-of-range numerical parameters.
```json
{
  "status": "error",
  "error_code": "INVALID_INPUT",
  "message": "Field 'Age' must be between 30 and 86."
}
```
* **`500 Internal Server Error`**: Unexpected prediction exception.
```json
{
  "status": "error",
  "error_code": "INFERENCE_FAILURE",
  "message": "Internal error during model inference."
}
```
