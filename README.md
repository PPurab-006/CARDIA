# CARDIA: Cardiovascular Risk Visualization & Multi-Vessel Stenosis AI Workstation

> **Track A: Cardiovascular Risk Visualization & Prediction** &bull; Multimodal AI Hackathon 2026  
> Educational Decision-Support Prototype

---

## 1. Project Overview

**CARDIA** is a clinical AI workstation and interactive 3D cardiovascular decision-support system. It predicts overall Coronary Artery Disease (CAD) risk along with vessel-specific stenosis probabilities ($\ge 50\%$ luminal narrowing) for the three principal coronary arteries:
- **LAD** &mdash; Left Anterior Descending Artery
- **LCX** &mdash; Left Circumflex Artery
- **RCA** &mdash; Right Coronary Artery

All predictions are dynamically projected onto an interactive 3D anatomical heart visualization with isolated, selectable coronary branches, local feature attributions, and strict anti-leakage guards.

---

## 2. Scientific & Clinical Transparency

### Anatomical Honesty Standard
The dataset does **not** contain patient-specific intravascular plaque coordinates or 3D computed tomography angiography (CCTA) geometry. In strict accordance with anatomical honesty:
- The 3D heart model represents an **anatomical reference standard**.
- Vessel color tones depict **model-predicted tabular statistical probabilities** ($\ge 50\%$ stenosis likelihood), never fabricated patient plaque lesions or simulated physical narrowing.
- High, moderate, and low risk bands (&gt;60%, 30–60%, &lt;30%) are labeled as **illustrative visualization tiers**, not validated clinical classification cutoffs.

### Mandatory Clinical Safety Notice
> **Educational and decision-support prototype only.** Predictions are not a diagnosis and must not replace professional medical evaluation or formal diagnostic imaging (e.g., invasive catheter angiography, CCTA). Models were trained on the UCI Z-Alizadeh Sani research cohort ($n=303$).

---

## 3. Dataset Provenance & Anti-Leakage Verification

- **Source Dataset:** UCI Machine Learning Repository ID 411: *"Extension of Z-Alizadeh Sani Dataset"*
- **DOI:** [10.24432/C5461K](https://doi.org/10.24432/C5461K)
- **Cohort Size:** 303 patients, 54 clean non-target clinical features across demographics, cardiovascular history, bedside examination, ECG, blood biochemistry, and echocardiography.
- **Zero Target Leakage:** Targets `Cath`, `LAD`, `LCX`, and `RCA` are strictly quarantined and barred from model inputs. The Flask API automatically rejects payloads containing forbidden target keys with HTTP 400.
- **Constant Feature Drop:** `Exertional CP` has zero variance in the raw data (all `'N'`) and was programmatically dropped during preprocessing.

---

## 4. Model Architectures & Cross-Validation Metrics

All models were evaluated using **Stratified 5-Fold Cross-Validation** with inside-fold preprocessing (`ColumnTransformer` fitting only on training folds to prevent data leakage).

| Target | Clinical Meaning | Selected Algorithm | ROC-AUC | F1-Score | Accuracy | Class Balance (Pos / Neg) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Cath (CAD)** | Overall CAD | `RandomForestClassifier` | **92.85%** | **91.63%** | **88.12%** | 216 / 87 |
| **LAD** | Anterior Descending Stenosis ($\ge 50\%$) | `GradientBoostingClassifier` | **83.65%** | **82.19%** | **78.55%** | 177 / 126 |
| **LCX** | Circumflex Stenosis ($\ge 50\%$) | `RandomForestClassifier` | **71.32%** | **59.20%** | **66.34%** | 119 / 184 |
| **RCA** | Right Coronary Stenosis ($\ge 50\%$) | `LogisticRegression` | **70.94%** | **58.87%** | **66.34%** | 114 / 189 |

*Metrics reflect internal cross-validation on 303 research subjects; not external clinical trial validation.*

---

## 5. 3D Heart Visualization Architecture

The 3D cardiac viewer is implemented in React Three Fiber (`@react-three/fiber`), Three.js, and `@react-three/drei`:
- **Anatomical Geometry:** Real human cardiac geometry sourced from the verified **BodyParts3D / Anatomography** database (Database Center for Life Science / DBCLS, Japan). The myocardium and separated coronary branches are extracted from release 4.0 (part-of hierarchy):
  - **Heart Myocardium (`FMA7088`):** Complete ventricular and atrial muscular walls.
  - **LAD (`FMA3862` / `FMA74912`):** Anterior interventricular branch, trunk, and diagonal branches.
  - **LCX (`FMA3895`):** Circumflex branch and obtuse marginal branches.
  - **RCA (`FMA50039` / `FMA3802`):** Right coronary trunk, acute marginal branches, conus artery, and posterior interventricular branch (PDA).
- **Interactive Inspection:** Individual hover highlights and click selection on LAD, LCX, and RCA coronary trees.
- **Camera & Scene Controls:** Drei `OrbitControls` with smooth damping, zoom boundaries, cardiac contraction toggle, and camera reset.
- **Lightweight WebGL:** Native Three.js `BufferGeometry` rendering at 60 FPS without requiring a dedicated GPU.
- **Attribution & License:**
  - **License:** Creative Commons Attribution-Share Alike 2.1 Japan ([CC BY-SA 2.1 JP](https://creativecommons.org/licenses/by-sa/2.1/jp/)).
  - **Attribution Notice:** *"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan"*.
  - **Modifications:** Normalized to unified millimeter center, transformed to Three.js coordinate system (Y-up, Z-front), precomputed vertex normals, and exported to optimized Three.js BufferGeometry JSON and Wavefront OBJ formats in `frontend/public/models/`.

---

## 6. How to Launch CARDIA

### Prerequisites
- Linux / macOS / Windows
- Python 3.11+
- Node.js 18+ and npm

### Terminal 1: Launch Backend API
```bash
# Navigate to project root
cd "/home/purab/Purab/Projects/competitions/multimodal cardio"

# Activate Python virtual environment
source .venv/bin/activate

# Run Flask REST API (serves on http://localhost:5000)
PYTHONPATH=. python src/api/app.py
```

### Terminal 2: Launch Frontend Workstation
```bash
# Navigate to frontend directory
cd "/home/purab/Purab/Projects/competitions/multimodal cardio/frontend"

# Install dependencies (if not already installed)
npm install

# Start Vite dev server (serves on http://localhost:5173)
npm run dev
```

Open your browser to: **`http://localhost:5173`**

---

## 7. Automated Test Suite

Run the full backend test suite (23 tests verifying anti-leakage rules, API contracts, constant feature dropping, and model integrity):

```bash
PYTHONPATH=. .venv/bin/pytest -v
```

Run the frontend TypeScript compilation and Vite production bundle build:

```bash
cd frontend && npm run build
```

---

## 8. Repository Structure

```
├── artifacts/
│   └── models/               # Joblib model pipelines & JSON schemas
├── data/
│   ├── processed/            # Cleaned Alizadeh-Sani CSV (303 rows)
│   └── raw/                  # Original UCI archive
├── docs/
│   ├── API_CONTRACT.md       # OpenAPI/REST endpoint specifications
│   └── LEAKAGE_AUDIT.md      # Comprehensive forensic leakage audit
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ClinicalForm.tsx       # Schema-driven patient input & synthetic samples
│   │   │   ├── FeatureExplanations.tsx# Local feature attributions (SHAP surrogate)
│   │   │   ├── Header.tsx             # CARDIA branding, health ping, action buttons
│   │   │   ├── HeartViewer.tsx        # 3D R3F Heart with isolated coronary vessels
│   │   │   ├── ModelMetricsModal.tsx  # Cross-validation performance audit modal
│   │   │   ├── RiskDashboard.tsx      # Multi-target probability cards & badges
│   │   │   └── SafetyDisclaimer.tsx   # Persistent clinical disclaimer banner
│   │   ├── lib/api.ts                 # Type-safe API client
│   │   ├── types/api.ts               # Shared TypeScript schemas
│   │   ├── App.tsx                    # Main workstation application layout
│   │   └── index.css                  # Dark clinical design system
├── results/
│   └── metrics/              # Model comparison tables & metrics JSON
├── src/
│   ├── api/                  # Flask REST API (routes, registry, validation)
│   └── ml/                   # Data preprocessing, training, evaluation, explanations
└── tests/
    ├── test_api.py           # API integration tests & leakage rejection tests
    └── test_ml_pipeline.py   # Machine learning pipeline unit tests
```
