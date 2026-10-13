# Forensic Machine Learning Leakage Audit

**Project:** Multimodal AI Hackathon 2026 — Track A: Cardiovascular Risk Visualization & Prediction  
**Dataset:** Extension of Z-Alizadeh Sani Dataset (UCI ID 411, DOI: 10.24432/C5461K)  
**Audit Date:** October 13, 2026  
**Auditor:** Technical Lead / Senior ML Engineer  
**Scope:** Complete inspection of preprocessing, feature definitions, model training, cross-validation evaluation, feature attributions, and exported artifacts.

---

## 1. Executive Summary & Audit Verdicts

| Audit Domain | Verdict | Evidence & Verification |
| :--- | :--- | :--- |
| **Direct Target Leakage** | **CLEAN / ZERO LEAKAGE** | All 4 target columns (`Cath`, `LAD`, `LCX`, `RCA`) are programmatically excluded from feature extraction in `src/ml/preprocess.py`, confirmed absent in `feature_schema.json`, and verified absent from all 4 saved model pipelines. |
| **Indirect & Post-Outcome Leakage** | **DEFENSIBLE (QUALIFIED)** | All 54 input features are legitimate pre-catheterization clinical variables (demographics, history, bedside exam, resting ECG, routine lab blood panel, transthoracic echo). No post-angiography outcomes, stent data, or surgical interventions exist in the predictor set. Echocardiographic functional parameters (`EF-TTE`, `Region RWMA`) are legitimate pre-angiography tests but are qualified as imaging findings. |
| **Preprocessing & Folding Integrity** | **CLEAN / ZERO LEAKAGE** | All scalers (`StandardScaler`) and encoders (`OneHotEncoder`) are encapsulated inside `sklearn.compose.ColumnTransformer` within `sklearn.pipeline.Pipeline`. Preprocessing fits strictly on the training fold of each split; zero test/validation contamination occurs. |
| **Cross-Validation & Metric Integrity** | **VERIFIED & REPRODUCIBLE** | Stratified 5-Fold CV is evaluated on the exact same folds across candidate models. ROC-AUC is calculated from positive-class predicted probabilities. Confusion matrices and supports match empirical data. No in-sample training metrics are reported as validation performance. |
| **Explanation Integrity** | **DEFENSIBLE** | Permutation importance and perturbation-based local feature attributions are clearly distinguished. Global importance is separated from patient-specific attributions, and causal claims are explicitly disclaimed. |

---

## 2. Part A1: Forensic Direct Target Leakage Audit

### Target Columns Under Audit
1. `Cath` (Overall Coronary Artery Disease diagnosis via catheterization, CAD vs. Normal)
2. `LAD` (Left Anterior Descending artery stenosis $\ge 50\%$)
3. `LCX` (Left Circumflex artery stenosis $\ge 50\%$)
4. `RCA` (Right Coronary Artery stenosis $\ge 50\%$)

### Verification Steps
1. **Source Code Inspection (`src/ml/preprocess.py`):**
   * Constant `TARGET_COLUMNS = ["Cath", "LAD", "LCX", "RCA"]` is defined.
   * `extract_features_and_target(df, target_name)` extracts the target column as $y$, then unconditionally drops all `TARGET_COLUMNS` and `CONSTANT_COLUMNS_TO_DROP` (`Exertional CP`) to construct $X$.
   * A programmatic guard clause raises `RuntimeError` if any target column is present in $X$.
2. **Artifact Inspection (`artifacts/models/`):**
   * Inspected `feature_names_in_` for each serialized pipeline (`cath_pipeline.joblib`, `lad_pipeline.joblib`, `lcx_pipeline.joblib`, `rca_pipeline.joblib`).
   * **Result:** Exactly 54 features in each pipeline. None of `Cath`, `LAD`, `LCX`, or `RCA` are present.
3. **Automated Test Verification (`tests/test_ml_pipeline.py`):**
   * `test_leakage_exclusion_rules` tests all 4 extraction pathways and asserts that none of the target columns exist in $X$. Verified passing in pytest.

### Complete List of 54 Evaluated Predictor Features
```
 1. Age                       19. PR                      37. BBB
 2. Weight                    20. Edema                   38. FBS
 3. Length (Height cm)        21. Weak Peripheral Pulse   39. CR (Creatinine)
 4. Sex                       22. Lung rales              40. TG (Triglycerides)
 5. BMI                       23. Systolic Murmur         41. LDL
 6. DM (Diabetes)             24. Diastolic Murmur        42. HDL
 7. HTN (Hypertension)        25. Typical Chest Pain      43. BUN
 8. Current Smoker            26. Dyspnea                 44. ESR
 9. EX-Smoker                 27. Function Class          45. HB (Hemoglobin)
10. FH (Family History)       28. Atypical                46. K (Potassium)
11. Obesity                   29. Nonanginal              47. Na (Sodium)
12. CRF (Chronic Renal Fail)  30. LowTH Ang               48. WBC
13. CVA (Stroke history)      31. Q Wave                  49. Lymph
14. Airway disease            32. St Elevation            50. Neut
15. Thyroid Disease           33. St Depression           51. PLT (Platelets)
16. CHF (Heart Failure)       34. Tinversion              52. EF-TTE (Echo EF %)
17. DLP (Dyslipidemia)        35. LVH                     53. Region RWMA (Echo)
18. BP (Blood Pressure)       36. Poor R Progression      54. VHD (Echo Valvular)
```

---

## 3. Part A2: Indirect Leakage & Clinical Timing Analysis

### Clinical Workflow Timing
In standard cardiovascular clinical management, a patient presenting with symptoms of suspected coronary artery disease undergoes non-invasive evaluation:
1. **Clinical Triage & Bedside Exam:** Demographics, cardiovascular risk history, vitals (`BP`, `PR`), chest pain characterization (`Typical Chest Pain`, `Atypical`, `Nonanginal`), and physical findings (`Murmurs`, `Rales`, `Edema`).
2. **Standard 12-Lead ECG:** Measured at rest (`ST depression`, `ST elevation`, `T inversion`, `Q waves`, `BBB`).
3. **Routine Admission Laboratory Panel:** Venous blood draw (`FBS`, `Lipid panel`, `Creatinine`, `Electrolytes`, `CBC`, `ESR`).
4. **Transthoracic Echocardiography (TTE):** Non-invasive ultrasound of the heart (`EF-TTE`, `Region RWMA`, `VHD`).
5. **Invasive Coronary Angiography (Catheterization):** The invasive diagnostic standard determining actual luminal stenosis percentages and defining `Cath`, `LAD`, `LCX`, and `RCA`.

### Examination of Specific High-Information Features
* **`Region RWMA` (Regional Wall Motion Abnormality score, 0–4):**
  * *Clinical Meaning:* Number of ventricular myocardial segments demonstrating hypokinesia, akinesia, or dyskinesia on 2D echocardiogram.
  * *Timing:* Non-invasive test performed *prior* to catheterization.
  * *Audit Verdict:* Defensible pre-angiography predictor. It indicates localized functional ischemia or prior infarction, but does not measure coronary artery luminal diameter or specific vessel stenosis geometry.
* **`EF-TTE` (Ejection Fraction on Transthoracic Echocardiography, %):**
  * *Clinical Meaning:* Global left ventricular systolic pump efficiency.
  * *Timing:* Non-invasive test performed *prior* to catheterization.
  * *Audit Verdict:* Legitimate physiological predictor. Low EF is a consequence of ischemic heart disease or cardiomyopathy, not an angiographic outcome.
* **`Typical Chest Pain`:**
  * *Clinical Meaning:* Classic substernal chest discomfort provoked by exertion and relieved by rest or nitroglycerin.
  * *Timing:* Elicited in patient anamnesis before any diagnostic testing.
  * *Audit Verdict:* Found to be the single strongest predictor of overall CAD and LAD disease, which mirrors standard Diamond-Forrester pre-test probability guidelines.

### Zero-Variance Pruning
* `Exertional CP`: Recorded as `'N'` in all 303 rows. It conveys zero information and has been dropped from the model input feature set.

---

## 4. Part A3: Cross-Validation & Metric Integrity

### Validation Protocol
* **Fold Strategy:** `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)`.
* **Identical Folds:** The exact same cross-validation splits were applied across all candidate models for each target.
* **Out-of-Fold (OOF) Prediction Accumulation:** Out-of-fold validation predictions were collected across all 5 folds without overlap:
  $$\bigcup_{k=1}^5 \text{val\_idx}_k = \{0, 1, \dots, 302\}, \quad \text{val\_idx}_i \cap \text{val\_idx}_j = \emptyset$$
* **Probability Computation:** ROC-AUC was computed exclusively from continuous predicted probabilities $P(y=1)$, looking up the positive class index in `classes_`.
* **Fold-Encapsulated Preprocessing:** The `ColumnTransformer` (fitting mean/variance for numeric scaling and categories for one-hot encoding) was instantiated freshly inside each CV fold loop and fitted strictly on `X_train`.

### Model Selection Optimism Note
Candidate model selection chose the top-performing architecture on the 5-fold cross-validation metrics using a composite score ($0.40 \cdot \text{F1} + 0.35 \cdot \text{ROC-AUC} + 0.25 \cdot \text{Recall}$).  
*Methodological Clarification:* In small datasets ($N=303$), selecting an algorithm on cross-validation performance without an external held-out test cohort introduces a modest degree of selection optimism. These reported metrics represent cross-validated out-of-fold performance on the Tehran Heart Center cohort and must not be described as proven generalization to unseen hospital populations.

---

## 5. Part A4: Metric Reproduction & Performance Challenge

### Reproduced Aggregate Out-of-Fold Metrics ($N=303$)

#### Target 1: Cath (Overall CAD — Positive Class: CAD, $N_{\text{pos}}=216$, $N_{\text{neg}}=87$)
* **LogisticRegression:** Accuracy: 85.15%, Precision: 0.9212, Recall: 0.8657, F1: 0.8926, ROC-AUC: 0.9242
* **RandomForest (SELECTED):** Accuracy: **88.12%**, Precision: **0.9206**, Recall: **0.9120**, F1: **0.9163**, ROC-AUC: **0.9285**
  * *Confusion Matrix:* TN = 70, FP = 17, FN = 19, TP = 197
  * *Fold Variability:* Accuracy: $88.10\% \pm 3.44\%$, ROC-AUC: $0.9352 \pm 0.0292$, F1: $0.9162 \pm 0.0234$
* **GradientBoosting:** Accuracy: 83.50%, Precision: 0.8517, Recall: 0.9306, F1: 0.8894, ROC-AUC: 0.9110

#### Target 2: LAD Stenosis ($\ge 50\%$ — Positive Class: Stenotic, $N_{\text{pos}}=177$, $N_{\text{neg}}=126$)
* **LogisticRegression:** Accuracy: 71.95%, Precision: 0.7805, Recall: 0.7232, F1: 0.7507, ROC-AUC: 0.8154
* **RandomForest:** Accuracy: 76.57%, Precision: 0.7944, Recall: 0.8079, F1: 0.8011, ROC-AUC: 0.8402
* **GradientBoosting (SELECTED):** Accuracy: **78.55%**, Precision: **0.7979**, Recall: **0.8475**, F1: **0.8219**, ROC-AUC: **0.8365**
  * *Confusion Matrix:* TN = 88, FP = 38, FN = 27, TP = 150
  * *Fold Variability:* Accuracy: $78.57\% \pm 5.51\%$, ROC-AUC: $0.8436 \pm 0.0610$, F1: $0.8224 \pm 0.0447$

#### Target 3: LCX Stenosis ($\ge 50\%$ — Positive Class: Stenotic, $N_{\text{pos}}=119$, $N_{\text{neg}}=184$)
* **LogisticRegression:** Accuracy: 62.38%, Precision: 0.5175, Recall: 0.6218, F1: 0.5649, ROC-AUC: 0.6682
* **RandomForest (SELECTED):** Accuracy: **66.34%**, Precision: **0.5649**, Recall: **0.6218**, F1: **0.5920**, ROC-AUC: **0.7132**
  * *Confusion Matrix:* TN = 127, FP = 57, FN = 45, TP = 74
  * *Fold Variability:* Accuracy: $66.36\% \pm 9.05\%$, ROC-AUC: $0.7201 \pm 0.0848$, F1: $0.5976 \pm 0.0750$
* **GradientBoosting:** Accuracy: 66.01%, Precision: 0.5800, Recall: 0.4874, F1: 0.5297, ROC-AUC: 0.7136

#### Target 4: RCA Stenosis ($\ge 50\%$ — Positive Class: Stenotic, $N_{\text{pos}}=114$, $N_{\text{neg}}=189$)
* **LogisticRegression (SELECTED):** Accuracy: **66.34%**, Precision: **0.5448**, Recall: **0.6404**, F1: **0.5887**, ROC-AUC: **0.7094**
  * *Confusion Matrix:* TN = 128, FP = 61, FN = 41, TP = 73
  * *Fold Variability:* Accuracy: $66.35\% \pm 2.01\%$, ROC-AUC: $0.7157 \pm 0.0252$, F1: $0.5865 \pm 0.0226$
* **RandomForest:** Accuracy: 66.34%, Precision: 0.5517, Recall: 0.5614, F1: 0.5565, ROC-AUC: 0.7021
* **GradientBoosting:** Accuracy: 64.36%, Precision: 0.5341, Recall: 0.4123, F1: 0.4653, ROC-AUC: 0.6884

### Why Is Overall CAD Accuracy (~88%) So High?
1. **Referral Bias:** All 303 patients were symptomatic individuals referred to Tehran Heart Center for catheterization; CAD prevalence is 71.3%. This is a selected high-risk cardiology cohort, not an unselected screening population.
2. **Clinical Signal Convergence:** Patients with confirmed severe CAD in this cohort demonstrate concurrent high-risk clinical markers: Diamond-Forrester typical angina, older age, diabetes, echocardiographic regional wall motion abnormalities (`Region RWMA`), and ECG changes (`ST depression`).
3. **Consistency with Published Literature:** Published benchmarks on this exact dataset report 86.8% to 92.1% accuracy (Alizadehsani et al., 2013; Arabasadi et al., 2017). The performance is fully accounted for by genuine clinical signal and matches the peer-reviewed baseline.

---

## 6. Audit Verdict

1. **Direct Leakage:** **None.**
2. **Indirect / Temporal Leakage:** **None.** All 54 features are strictly pre-angiography parameters.
3. **Evaluation Defect:** **None.** Strict stratified K-fold cross-validation with inside-fold fitting was verified and replicated exactly.
4. **Actionable Recommendations for Prototype Deployment:**
   - Always display the clinical disclaimer prominently.
   - Maintain the separation of overall CAD risk vs. anatomical vessel probabilities.
   - Guard the inference API against client requests containing forbidden target columns.
