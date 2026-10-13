# CARDIA: Cardiovascular Risk Visualization & Multi-Vessel Stenosis AI Workstation
## Technical Submission Report & System Documentation

**Track A: Cardiovascular Risk Visualization & Prediction** &bull; Multimodal AI Hackathon 2026  
**Document Version:** 1.0 (Final Submission) &bull; **Date:** October 2026  
**Project Repository:** `/home/purab/Purab/Projects/competitions/multimodal cardio`  
**License Notice:** Code and pipeline &copy; 2026 CARDIA Contributors. 3D anatomical models sourced from BodyParts3D (&copy; The Database Center for Life Science, CC BY-SA 2.1 Japan).

---

## 1. Project Overview

### 1.1 Clinical Problem Statement
Coronary artery disease (CAD) remains the primary contributor to cardiovascular mortality worldwide. Definitive diagnosis requires invasive catheter coronary angiography (ICA) or coronary computed tomography angiography (CCTA). While ICA represents the clinical gold standard for quantifying stenosis, it carries procedural risks, institutional expense, and catheterization laboratory resource bottlenecks. Conversely, routine clinical workups capture non-invasive data—patient demographics, resting 12-lead electrocardiography (ECG), blood biochemistry, and transthoracic echocardiography (TTE)—yet clinicians often evaluate these disparate modalities through fragmented mental models or isolated risk scoring tools (such as Framingham or ASCVD risk calculators) that produce only aggregate cardiovascular risk scores without anatomical vessel localization.

### 1.2 System Purpose & Key Contribution
CARDIA is a clinical decision-support and visual exploration prototype engineered to bridge routine non-invasive clinical evaluation with multi-vessel anatomical risk communication. Rather than predicting only a monolithic binary CAD label, CARDIA simultaneously evaluates:
1. **Overall CAD Status (`Cath`):** Documenting whether the patient exhibits significant stenosis ($\ge 50\%$) in at least one major coronary artery.
2. **Left Anterior Descending Artery (`LAD`):** Predicting stenosis likelihood in the anterior interventricular circulation.
3. **Left Circumflex Artery (`LCX`):** Predicting stenosis likelihood in the lateral/posterior left ventricular circulation.
4. **Right Coronary Artery (`RCA`):** Predicting stenosis likelihood in the inferior and right ventricular circulation.

These statistical predictions are coupled directly to a real-time, three-dimensional coronary vascular tree rendered using WebGL. Clinicians and researchers can interactively inspect isolated coronary branches, review local feature contributions that drove the statistical probability, and verify cross-validation performance metrics through a unified workstation interface.

### 1.3 Anatomical Reference Model Boundary
To maintain scientific transparency and prevent clinical misinterpretation:
- **Reference Geometry:** The 3D heart and coronary meshes utilized in CARDIA are standard anatomical reference geometries derived from the BodyParts3D/Anatomography digital human atlas (DBCLS, Japan). They do **not** represent patient-specific CCTA segmentations, 3D fluoroscopic reconstructions, or intravascular ultrasound (IVUS) acquisitions.
- **Statistical Probability Mapping:** Vessel color tones (green for low, amber for moderate, red for high risk) represent model-estimated likelihoods of $\ge 50\%$ luminal narrowing based on tabular clinical features. They do **not** delineate physical plaque geometry, calcification burden, or localized lesion sites.
- **Scope:** CARDIA is strictly an educational research prototype and clinical decision-support demonstration. It does not provide medical diagnoses and cannot substitute for invasive angiography or expert clinical judgment.

---

## 2. Dataset and Preprocessing

### 2.1 Dataset Provenance & Cohort Description
The models were trained on the **Extension of Z-Alizadeh Sani Dataset**, archived in the UC Irvine Machine Learning Repository:
- **Repository Identifier:** UCI Machine Learning Repository #411
- **Digital Object Identifier (DOI):** [10.24432/C5461K](https://doi.org/10.24432/C5461K)
- **Originating Institution:** Tehran Heart Center, Tehran, Iran
- **Cohort Size:** $n = 303$ consecutive patients referred for diagnostic catheter coronary angiography.
- **Raw Dimensions:** 303 rows $\times$ 59 columns.

The cohort reflects patients evaluated at a tertiary cardiovascular center presenting with suspected coronary disease. Consequently, the cohort exhibits an elevated baseline disease prevalence compared to an unselected primary care screening population.

### 2.2 Feature Audit and Preprocessing
The dataset contains 54 usable predictor variables spanning six clinical domains:
1. **Demographics (4 features):** Age (range 30–86 in training cohort), Sex, Weight (kg), Length (height, cm).
2. **Cardiovascular Risk Factors & History (8 features):** Body Mass Index (BMI), Diabetes Mellitus (DM), Hypertension (HTN), Current Smoker, Ex-Smoker, Family History of CAD (FH), Obesity, Dyslipidemia (DLP).
3. **Medical Comorbidities (5 features):** Chronic Renal Failure (CRF), Cerebrovascular Accident (CVA), Airway Disease, Thyroid Disease, Congestive Heart Failure (CHF).
4. **Physical Symptoms & Bedside Examination (9 features):** Blood Pressure (systolic BP), Pulse Rate (PR), Edema, Weak Peripheral Pulse, Lung Rales, Systolic Murmur, Diastolic Murmur, Typical Chest Pain, Dyspnea, Functional Class (NYHA 0–3), Atypical Chest Pain, Nonanginal Pain, Low-Threshold Angina.
5. **Resting 12-Lead ECG (8 features):** Pathological Q Wave, ST-Segment Elevation, ST-Segment Depression, T-Wave Inversion, Left Ventricular Hypertrophy (LVH), Poor R-Wave Progression, Bundle Branch Block (BBB: None, LBBB, RBBB).
6. **Laboratory Biochemistry (14 features):** Fasting Blood Sugar (FBS), Serum Creatinine (CR), Triglycerides (TG), Low-Density Lipoprotein (LDL), High-Density Lipoprotein (HDL), Blood Urea Nitrogen (BUN), Erythrocyte Sedimentation Rate (ESR), Hemoglobin (HB), Potassium (K), Sodium (Na), White Blood Cell Count (WBC), Lymphocyte Percentage (Lymph), Neutrophil Percentage (Neut), Platelet Count (PLT).
7. **Transthoracic Echocardiography (3 features):** Left Ventricular Ejection Fraction (EF-TTE), Regional Wall Motion Abnormality (Region RWMA: 0–4 score), Valvular Heart Disease (VHD: None, Mild, Moderate, Severe).

#### Data Cleaning Operations
- **Typographical Normalization:** In the raw dataset, the `Sex` column contained 127 entries recorded as `'Fmale'`. These were standardized to `'Female'` (leaving 176 Male, 127 Female).
- **Constant Feature Elimination:** The feature `Exertional CP` exhibited zero variance across all 303 records (100% recorded as `'N'`). It carries zero statistical information and was eliminated from the feature matrix to reduce dimensionality.
- **Completeness:** The audited dataset contained zero missing fields across all 303 rows and 59 columns, requiring no algorithmic imputation.

### 2.3 Target Quarantine and Anti-Leakage Safeguards
The dataset records four diagnostic outcome columns confirmed via invasive catheter coronary angiography:
- `Cath`: Binary catheterization outcome (`CAD` vs. `Normal`).
- `LAD`: Stenosis in the left anterior descending artery ($\ge 50\%$ vs. `<50%`/Normal).
- `LCX`: Stenosis in the left circumflex artery ($\ge 50\%$ vs. `<50%`/Normal).
- `RCA`: Stenosis in the right coronary artery ($\ge 50\%$ vs. `<50%`/Normal).

**Anti-Leakage Isolation:** To prevent catastrophic target leakage:
1. `Cath`, `LAD`, `LCX`, and `RCA` are quarantined as prediction targets and strictly excluded from the predictor matrix $X \in \mathbb{R}^{303 \times 54}$.
2. The targets are never used as cross-predictors for one another (e.g., predicted `Cath` does not feed into `LAD`, nor does `LAD` feed into `Cath`).
3. The Flask API incorporates strict schema validation that automatically rejects any inbound payload containing `Cath`, `LAD`, `LCX`, `RCA`, or alias `CAD` with an HTTP 400 Bad Request error.

### 2.4 Class Distributions and Data Quality Caveats
The class balance across the 303 subjects is summarized below:

| Target Variable | Clinical Meaning | Positive Cases | Negative Cases | Positive Prevalence |
| :--- | :--- | :---: | :---: | :---: |
| **Cath** | Overall Significant CAD | 216 | 87 | 71.29% |
| **LAD** | Anterior Descending Stenosis ($\ge 50\%$) | 177 | 126 | 58.42% |
| **LCX** | Circumflex Stenosis ($\ge 50\%$) | 119 | 184 | 39.27% |
| **RCA** | Right Coronary Stenosis ($\ge 50\%$) | 114 | 189 | 37.62% |

#### Data Quality Caveats
1. **Row 94 Discrepancy:** Patient row 94 in the raw clinical registry records `Cath` = `Normal` while `LAD` = `Stenotic` (`LCX` = `Normal`, `RCA` = `Normal`). Under clinical definitions, an isolated $\ge 50\%$ stenosis in the LAD typically constitutes CAD. Rather than altering clinical records post-hoc, this discrepancy was preserved exactly as recorded in the source repository to maintain evidentiary integrity.
2. **Small Cohort Size:** With $n=303$, the statistical power to model rare interaction terms or complex non-linear manifolds across 54 features is limited. Overfitting is an inherent hazard that requires strict cross-validation safeguards.
3. **Referral Population Bias:** The 71.3% baseline prevalence of CAD reflects a tertiary center referral cohort undergoing invasive catheterization. Performance metrics derived here will not directly translate to primary care asymptomatic screening without recalibration.

---

## 3. Methodology

### 3.1 Supervised Learning Framework
CARDIA frames cardiovascular risk evaluation as four distinct binary classification tasks:
$$f_{\text{Cath}}: \mathcal{X} \to [0, 1], \quad f_{\text{LAD}}: \mathcal{X} \to [0, 1], \quad f_{\text{LCX}}: \mathcal{X} \to [0, 1], \quad f_{\text{RCA}}: \mathcal{X} \to [0, 1]$$
where $\mathcal{X} \subset \mathbb{R}^{54}$ represents the clinical feature space.

### 3.2 Candidate Models Evaluated
Three representative model families spanning linear, bagged ensemble, and boosted ensemble paradigms were trained and evaluated independently for each target:
1. **Logistic Regression (`LogisticRegression`):** L2-regularized linear model ($C=1.0$, `lbfgs` solver, max iterations 1000). Serves as an interpretable linear baseline.
2. **Random Forest (`RandomForestClassifier`):** Bagged ensemble of 200 decision trees (`n_estimators=200`, `max_depth=6`, `min_samples_split=4`, `random_state=42`).
3. **Gradient Boosting (`GradientBoostingClassifier`):** Sequentially boosted decision trees (`n_estimators=100`, `learning_rate=0.05`, `max_depth=3`, `subsample=0.8`, `random_state=42`).

### 3.3 Leakage-Proof Cross-Validation Architecture
To guarantee unbiased performance estimation:
- **Stratified 5-Fold Cross-Validation:** The 303 samples were partitioned into 5 stratified folds for each target, preserving target class proportions within each split.
- **Inside-Fold Pipeline Encapsulation:** Feature transformations were encapsulated within scikit-learn `Pipeline` and `ColumnTransformer` constructs. Scaling parameters (mean and variance for continuous variables) and one-hot encoding categories were fitted strictly on the 4 training folds and applied out-of-fold to the test fold. No global preprocessing was executed on the combined dataset prior to splitting.
- **Preprocessing Pipelines:**
  - Continuous features (38 numerical variables): Imputed/standardized using `StandardScaler`.
  - Categorical features (16 variables): Transformed using `OneHotEncoder(handle_unknown='ignore', sparse_output=False)`.

### 3.4 Model Selection Criterion
In clinical screening, false negatives (missing a stenosed artery) carry severe clinical risks, whereas false positives result in confirmatory diagnostic testing. Relying solely on accuracy in imbalanced datasets ($71.3\%$ CAD, $37.6\%$ RCA) produces distorted rankings. Therefore, candidate models were selected using a clinically grounded composite scoring function:
$$\text{Score}_{\text{composite}} = 0.40 \times F_1 + 0.35 \times \text{ROC-AUC} + 0.25 \times \text{Recall}$$
This objective prioritizes models that balance discriminatory capability (ROC-AUC), precision-recall balance ($F_1$), and high sensitivity (Recall) for ischemic disease detection.

### 3.5 Feature Attribution Methodology
To explain model decisions without confounding correlation with causation:
- **Global Feature Importance:** Permutation feature importance was computed over out-of-fold cross-validation test sets across 10 permutations. Features causing the steepest degradation in scoring metric when shuffled were ranked highest.
- **Patient-Level Local Explanations:** For real-time inference on a specific patient payload, CARDIA computes localized feature attributions against the training cohort background distribution. The top positive contributors (driving probability upward) and top negative contributors (mitigating risk) are extracted and displayed alongside patient values.
- **Causality vs. Association Distinction:** All user interfaces and documentation explicitly declare that feature attributions represent statistical model sensitivity within this cohort, not established causal pathophysiology. For example, while elevated ESR or typical chest pain increases model risk, modifying ESR directly without treating underlying inflammatory or atherosclerotic etiology does not imply risk reduction.

### 3.6 Vessel Colormap Projection
Predicted probabilities for LAD, LCX, and RCA are mapped to coronary vascular geometry using three illustrative visualization tiers:
- **Low Risk ($\hat{p} < 0.30$):** Emerald Green (`#10b981`), indicating low statistical likelihood of significant luminal stenosis.
- **Moderate Risk ($0.30 \le \hat{p} \le 0.60$):** Amber (`#f59e0b`), indicating intermediate probability warranting clinical surveillance.
- **High Risk ($\hat{p} > 0.60$):** Crimson Red (`#ef4444`), highlighting elevated likelihood of $\ge 50\%$ luminal narrowing.

These threshold bands serve as intuitive user-interface indicators for exploratory risk triage and are explicitly documented as non-standardized clinical cutoffs.

---

## 4. Architecture and Implementation

### 4.1 End-to-End System Architecture
CARDIA comprises a modular two-tier architecture separating the high-performance ML inference runtime from the WebGL presentation layer:

```
+-------------------------------------------------------------------------------+
|                      CARDIA WORKSTATION FRONTEND                              |
|  React 18  *  TypeScript  *  Vite  *  React Three Fiber  *  Three.js  *  CSS  |
|                                                                               |
|  +--------------------+  +----------------------+  +-----------------------+  |
|  |   Clinical Form    |  |  Interactive 3D Heart|  |    Risk Dashboard     |  |
|  | 54 features across |  |  BodyParts3D anatomy |  | Multi-target cards    |  |
|  | 6 domain categories|  |  Isolated LAD/LCX/RCA|  | Probabilities & tiers |  |
|  | Synthetic profiles |  |  Mesh raycasting     |  | Feature explanations  |  |
|  +---------+----------+  +----------+-----------+  +-----------+-----------+  |
+------------|------------------------|--------------------------|--------------+
             | REST Payloads          | Color Updates            | Attributions
             v                        v                          v
+-------------------------------------------------------------------------------+
|                        FLASK REST API SERVICE (Python)                        |
|                                                                               |
|  +---------------------------------+   +------------------------------------+ |
|  |       Input Validation Engine   |   |       Model Inference Registry     | |
|  | Schema conformance check        |   | Pre-loaded pipelines (joblib)      | |
|  | Target column rejection guard   |   | Feature order preservation         | |
|  | Numeric & categorical bounds    |   | Local surrogate explanation engine | |
|  | Age policy (18-100; warnings)   |   | Benchmark metrics provider         | |
|  +---------------------------------+   +------------------------------------+ |
+-------------------------------------------------------------------------------+
```

### 4.2 Backend REST API Service
Implemented in Python using Flask, Flask-CORS, and joblib:
- **Pre-Loaded Model Registry (`ModelRegistry`):** Model pipelines (`cath_pipeline.joblib`, `lad_pipeline.joblib`, `lcx_pipeline.joblib`, `rca_pipeline.joblib`), feature schema, and reference background distributions are loaded into memory at application startup, eliminating disk I/O overhead during request processing.
- **Documented Endpoints:**
  1. `GET /api/health`: Health status, loaded model verification, and timestamp.
  2. `GET /api/schema`: Complete 54-feature clinical schema, data types, permitted options, and biological reference ranges.
  3. `GET /api/metrics`: Cross-validation performance metrics, confusion matrices, and model selection rationales for all four targets.
  4. `GET /api/sample-patients`: Five pre-configured clinical reference profiles (Low Risk Asymptomatic, Moderate Risk Atypical, High Risk Multi-Vessel Ischemia, Isolated LAD Lesion, Young Extrapolation Profile).
  5. `POST /api/predict`: Multi-target inference endpoint returning overall CAD probability, vessel-specific probabilities with colormaps, local feature attributions, and clinical disclaimer.

### 4.3 Validation Policies & Out-of-Cohort Extrapolation Guard
The API enforces multi-layer input sanitation:
- **Target Key Quarantine:** Inbound payloads containing `cath`, `lad`, `lcx`, `rca`, or `cad` trigger immediate HTTP 400 rejection with an explicit anti-leakage diagnostic message.
- **Type and Range Verification:** Numerical features are validated against physiological bounds; categorical features are verified against discrete permitted sets. Non-numeric inputs, `NaN`, or `Infinity` are rejected with HTTP 400.
- **Age Validation Policy:**
  - Ages `< 18` or `> 100` are rejected with HTTP 400 (`Age must be an integer between 18 and 100`).
  - Ages `18–29` and `87–100` fall outside the observed training cohort ($30 \le \text{Age} \le 86$). The system permits inference for research utility but issues a prominent extrapolation warning: *"Age is outside the observed training cohort (30–86 years). Prediction reflects statistical extrapolation."*

### 4.4 Frontend Workstation & 3D WebGL Engine
Built on modern web technologies:
- **Framework:** React 18, TypeScript, Vite.
- **3D Visualization:** Three.js, React Three Fiber (`@react-three/fiber`), and `@react-three/drei`.
- **Anatomical Geometry:** Sourced from BodyParts3D/Anatomography release 4.0. The myocardial wall (`FMA7088`) and separated coronary arteries (`LAD: FMA3862/74912`, `LCX: FMA3895`, `RCA: FMA50039/3802`) were converted to optimized Three.js `BufferGeometry` structures centered at the origin.
- **Interaction Model:** Orbit controls with pan, rotate, and zoom limits; toggleable anatomical heartbeat contraction; individual vessel hover and click selection; and dynamic vertex colormap updating based on inference responses.
- **Responsive Layout:** Engineered using modern CSS Grid and Flexbox across three responsive viewports: 3-column desktop ($\ge 1200\text{px}$), 2-column tablet ($768\text{px} - 1199\text{px}$), and stacked 1-column mobile ($< 768\text{px}$).

---

## 5. Evaluation and Results

### 5.1 Verification Source and Methodology
All reported evaluation figures derive strictly from out-of-fold cross-validation predictions pooled across all 303 samples during Stratified 5-Fold Cross-Validation, serialized in `results/metrics/model_comparison.csv` and `results/metrics/selected_model_metrics.json`. No metrics represent training set resubstitution or unverified estimates.

### 5.2 Performance Comparison Across All Candidate Models
Table 1 documents the performance of every evaluated model family across all four targets ($n=303$ pooled out-of-fold evaluations):

#### Table 1: Stratified 5-Fold Cross-Validation Model Comparison ($n=303$)

| Target | Model Candidate | Accuracy | Precision | Recall | F1-Score | ROC-AUC | Selection Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Cath** | Logistic Regression | 85.15% | 92.12% | 86.57% | 89.26% | 92.42% | Candidate |
| | **Random Forest** | **88.12%** | **92.06%** | **91.20%** | **91.63%** | **92.85%** | **Selected** |
| | Gradient Boosting | 83.50% | 85.17% | 93.06% | 88.94% | 91.10% | Candidate |
| **LAD** | Logistic Regression | 71.95% | 78.05% | 72.32% | 75.07% | 81.54% | Candidate |
| | Random Forest | 76.57% | 79.44% | 80.79% | 80.11% | 84.02% | Candidate |
| | **Gradient Boosting** | **78.55%** | **79.79%** | **84.75%** | **82.19%** | **83.65%** | **Selected** |
| **LCX** | Logistic Regression | 62.38% | 51.75% | 62.18% | 56.49% | 66.82% | Candidate |
| | **Random Forest** | **66.34%** | **56.49%** | **62.18%** | **59.20%** | **71.32%** | **Selected** |
| | Gradient Boosting | 66.01% | 58.00% | 48.74% | 52.97% | 71.36% | Candidate |
| **RCA** | **Logistic Regression** | **66.34%** | **54.48%** | **64.04%** | **58.87%** | **70.94%** | **Selected** |
| | Random Forest | 66.34% | 55.17% | 56.14% | 55.65% | 70.21% | Candidate |
| | Gradient Boosting | 64.36% | 53.41% | 41.23% | 46.53% | 68.84% | Candidate |

### 5.3 Selected Model Summary & Confusion Matrices
Table 2 details the performance and confusion matrices of the models selected for deployment:

#### Table 2: Deployable Pipeline Performance & Confusion Matrix Breakdown

| Target | Selected Model | Accuracy | Precision | Recall | F1 | ROC-AUC | TN | FP | FN | TP |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Cath** | Random Forest | 88.12% | 92.06% | 91.20% | 91.63% | 92.85% | 70 | 17 | 19 | 197 |
| **LAD** | Gradient Boosting | 78.55% | 79.79% | 84.75% | 82.19% | 83.65% | 88 | 38 | 27 | 150 |
| **LCX** | Random Forest | 66.34% | 56.49% | 62.18% | 59.20% | 71.32% | 127 | 57 | 45 | 74 |
| **RCA** | Logistic Regression | 66.34% | 54.48% | 64.04% | 58.87% | 70.94% | 128 | 61 | 41 | 73 |

### 5.4 Analysis of Target Disparity: LAD vs. LCX/RCA
A prominent technical finding in the evaluation is the significant performance gradient between targets:
- **High Discrimination for Cath and LAD:** Overall CAD (`Cath`: 92.85% ROC-AUC) and LAD stenosis (`LAD`: 83.65% ROC-AUC) demonstrate high predictive discrimination. An extensive anatomical territory (anterior wall, septum, apex) is supplied by the LAD. Ischemia in this territory produces classic findings on resting 12-lead ECG (V1–V4 ST-segment shifts, T-wave inversions, pathological Q waves) and resting echocardiography (anterior regional wall motion abnormalities), providing strong signal for tabular models.
- **Attenuated Performance for LCX and RCA:** LCX (71.32% ROC-AUC, 59.20% F1) and RCA (70.94% ROC-AUC, 58.87% F1) exhibit noticeably lower performance. This is explained by well-established clinical and physiological mechanisms:
  1. *Electrocardiographic Insensitivity:* Standard resting 12-lead ECG is notoriously insensitive to the posterior and lateral left ventricular myocardium supplied by the LCX. Ischemia in the circumflex territory is frequently "electrically silent" on standard anterior-precordial leads unless posterior leads (V7–V9) are applied.
  2. *Coronary Dominance & Collateral Flow:* Coronary circulation exhibits variable dominance (approximately 85% right-dominant, 10% left-dominant, 5% codominant). A lesion in a non-dominant vessel produces minimal resting functional impairment or biomarker disturbance compared to a lesion in a dominant vessel.
  3. *Class Imbalance:* Both LCX (39.3% positive) and RCA (37.6% positive) are minority classes in the dataset, reducing positive training examples relative to overall CAD (71.3% positive).

### 5.5 Limitations of Evaluation Methodology
1. **Pooled Out-of-Fold Estimation:** While cross-validation prevents training resubstitution bias, pooling test folds yields an aggregate point estimate that does not account for variance across folds.
2. **Model Selection Optimism:** Selecting the highest-performing model on cross-validation metrics introduces a slight degree of selection optimism. Independent test set verification is required.
3. **Absence of Calibration Verification:** Model probabilities were not subjected to isotonic regression or Platt scaling calibration on an independent holdout set. Therefore, output probabilities must be interpreted as monotonic risk rankings rather than true frequentist event probabilities.

---

## 6. Limitations, Responsible Use, and Future Work

### 6.1 Explicit System Limitations
To uphold academic and engineering honesty, CARDIA's scope and constraints are documented below:
1. **Cohort Size Constraint ($n=303$):** The dataset represents 303 individuals from a single medical center. It lacks the statistical power to capture diverse multi-ethnic populations or subtle clinical phenotypes.
2. **Single-Center Retrospective Bias:** All subjects were referred for invasive catheter angiography due to high pre-test clinical suspicion. Models trained on this cohort will exhibit elevated false-positive rates if deployed in unselected primary care screening cohorts with lower base prevalence.
3. **Absence of Plaque Localization:** The 3D heart model reflects idealized reference anatomy. CARDIA cannot identify the anatomical segment (proximal, mid, or distal) of stenosis, nor can it detect plaque morphology, calcification, or ulceration.
4. **Non-Causal Feature Importances:** Feature importance weights reflect statistical associations within this retrospective sample. They do not constitute causal pathophysiological evidence or treatment targets.
5. **Extrapolation Uncertainty:** Input profiles with age $<30$ or $>86$, or extreme physiological values, fall outside the observed training manifold and carry heightened predictive uncertainty.

### 6.2 Responsible Use & Clinical Safety Declaration
> **RESEARCH & EDUCATIONAL PROTOTYPE ONLY**  
> CARDIA is designed exclusively as an exploratory decision-support demonstration and educational tool for clinical AI research. It is **not** a cleared medical device and must never be utilized as the sole or primary basis for diagnostic, therapeutic, surgical, or interventional decisions. All predictions must be evaluated by licensed healthcare professionals in conjunction with standard diagnostic modalities, formal imaging, and patient clinical history.

### 6.3 Future Work Roadmap
The following directions are identified as necessary next steps prior to clinical translational consideration:
1. **External Multicenter Validation:** Evaluating model generalization across external multi-center registries (e.g., Cleveland Clinic, Hungarian, Long Beach, and Swiss cohorts) without retraining.
2. **Probability Calibration:** Implementing temperature scaling or isotonic regression on holdout validation cohorts to guarantee calibrated predictive probabilities.
3. **True Multimodal Image Integration:** Replacing the tabular-to-3D reference mapping with native multimodal architectures capable of directly ingesting raw 12-lead ECG waveforms and echocardiographic video loops alongside tabular EHR data.
4. **Patient-Specific Vascular Mesh Generation:** Developing deep learning reconstruction pipelines to generate patient-specific 3D coronary trees directly from CCTA DICOM volumes.

---

## 7. References

1. **Alizadeh-Sani, R., Roshanzamir, M., Abdar, M., Beykikhoshk, A., Khosravi, A., Nahavandi, S., Tan, K. C., & Acharya, U. R.** (2017). *A database of patients for coronary artery disease diagnosis with extension of features.* Extension of Z-Alizadeh Sani Dataset, UC Irvine Machine Learning Repository. DOI: [10.24432/C5461K](https://doi.org/10.24432/C5461K).
2. **Database Center for Life Science (DBCLS), Japan.** (2013). *BodyParts3D: 3D Anatomical Concepts for Anatomography.* Anatomical ontology and reference meshes (Heart: `FMA7088`, LAD: `FMA3862`, LCX: `FMA3895`, RCA: `FMA50039`). Licensed under Creative Commons Attribution-Share Alike 2.1 Japan (CC BY-SA 2.1 JP). Available at: [https://lifesciencedb.jp/bp3d/](https://lifesciencedb.jp/bp3d/).
3. **Pedregosa, F., Varoquaux, G., Gramfort, A., Michel, V., Thirion, B., Grisel, O., Blondel, M., Prettenhofer, P., Weiss, R., Dubourg, V., Vanderplas, J., Passos, A., Cournapeau, D., Brucher, M., Perrot, M., & Duchesnay, E.** (2011). *Scikit-learn: Machine Learning in Python.* Journal of Machine Learning Research, 12, 2825–2830.
4. **Wellens, H. J., & Conover, M. B.** (2006). *The ECG in Emergency Decision Making.* 2nd Edition, Saunders Elsevier. (Clinical basis for 12-lead ECG insensitivity in circumflex and posterior myocardial ischemia).
5. **Knuuti, J., Wijns, W., Saraste, A., Capodanno, D., Barbato, E., Funck-Brentano, C., Prescott, E., Storey, R. F., et al.** (2020). *2019 ESC Guidelines for the diagnosis and management of chronic coronary syndromes.* European Heart Journal, 41(3), 407–477. DOI: [10.1093/eurheartj/ehz425](https://doi.org/10.1093/eurheartj/ehz425).
6. **Cabello, R., et al.** (2024). *Three.js: JavaScript 3D Library.* Open-source WebGL 3D rendering engine. Available at: [https://threejs.org/](https://threejs.org/).
7. **Lundberg, S. M., & Lee, S. I.** (2017). *A Unified Approach to Interpreting Model Predictions.* Advances in Neural Information Processing Systems 30 (NeurIPS 2017).
