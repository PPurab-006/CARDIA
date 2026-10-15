# CARDIA Hackathon Demo Video — Timing Breakdown & Shot List

- **Video Path:** `demo/CARDIA_Demo.mp4`
- **Total Duration:** 88.23 seconds (01:28.23) — *Target: 75–110 seconds*
- **Resolution:** 1920 × 1080 (Full HD, 1:1 Square Pixel Aspect Ratio, 16:9 Display Aspect Ratio)
- **Frame Rate:** 30.00 FPS constant
- **Video Codec:** H.264 / AVC (High Profile, YUV420p, CRF 18, Web-Optimized `+faststart`)
- **Audio:** Silent (Voiceless, on-screen neo-brutalist captions)
- **File Size:** ~19.9 MB (19,957,503 bytes)
- **YouTube Thumbnail:** `demo/CARDIA_Thumbnail.png` (1920×1080 Full HD PNG)
- **Automation Script:** `scripts/record_demo_video.py`

---

## Shot List & Narrative Sequence

| Timestamp | Duration | Scene & Focus | Visual Elements & On-Screen Captions |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:04** | 4.0s | **01 // Opening Title Card** | Fullscreen title banner on warm beige technical grid: `CARDIA // Cardiovascular Risk Intelligence`, Track A badge, research metadata tags (`UCI-411 COHORT (n=303)`, `BODYPARTS3D FMA7088`, `ZERO LEAKAGE AUDITED`). |
| **0:04 – 0:13** | 9.0s | **02 // Workstation Architecture** | Seamless reveal of the CARDIA research interface. Mouse glides across header brand and live API health telemetry pill (`SYS.API // ONLINE`), then inspects the research metadata ribbon. <br>**Caption:** `[ 01 // WORKSTATION ] CARDIA: Integrated clinical AI decision workstation with real-time API health telemetry.` |
| **0:13 – 0:26** | 13.0s | **03 // Multimodal Patient Input** | Selects Illustrative Synthetic Profile 1 (*High Multi-Vessel Risk*). Cycles through clinical category tabs to showcase the breadth of 54 schema-validated covariates (History, Symptoms, ECG, Labs, Echocardiography). <br>**Caption:** `[ 02 // CLINICAL COVARIATES ] Loading high multi-vessel risk profile across 54 schema-validated multimodal covariates.` |
| **0:26 – 0:48** | 22.0s | **04 // 3D Anatomical Coronary Arborization** | Demonstrates smooth 3D orbital manipulation of the BodyParts3D FMA7088 heart mesh over the warm beige grid. Selects individual coronary branches (LAD, LCX, RCA) with territorial illumination, inspects the anatomical territory cards, and activates the physiological cardiac contraction cycle. <br>**Captions:** `[ 03 // 3D ATLAS ]`, `[ 03 // INTERACTION ]`, `[ 03 // CORONARY BRANCHES ]`, `[ 03 // DYNAMICS ]`. |
| **0:48 – 1:04** | 16.0s | **05 // Multi-Target Prediction Engine** | Clicks `[ RUN MULTI-VESSEL ANALYSIS ]`. Real API response renders instantaneously: Overall CAD **94.6%** probability (High Stenosis Likelihood, RandomForest CV AUC 92.8%), vessel-specific stenosis breakdowns (LAD 96.5%, LCX 67.2%, RCA 88.6%), with dynamic risk recoloring on the 3D heart. <br>**Captions:** `[ 04 // INFERENCE ENGINE ]`, `[ 04 // PRIMARY RESULT ]`, `[ 04 // VESSEL BREAKDOWN ]`. |
| **1:04 – 1:23** | 19.0s | **06 // Explainability & Cross-Validation Audit** | Explores patient-specific TreeSHAP feature attributions (`Region RWMA = 2.0`, `Patient Age = 68.0`, `Chest Pain`), switches attribution target to the LAD branch, and launches the full **Model Evaluation & CV Audit Modal** displaying audited 5-fold cross-validation metrics and algorithm selection rationales. <br>**Captions:** `[ 05 // EXPLAINABILITY ]`, `[ 05 // VESSEL ATTRIBUTION ]`, `[ 05 // AUDITED METRICS ]`. |
| **1:23 – 1:28** | 5.2s | **07 // Closing Card & Clinical Disclaimer** | Clean fullscreen card presenting non-diagnostic statutory notice, academic citations (UCI-411 / Z-Alizadeh Sani, BodyParts3D DBCLS), and live deployment URL (`cardia-five.vercel.app`). |

---

## Technical Verification & Artifact Integrity

1. **Duration Compliance:** 88.23s, strictly within the requested 75–110 second window.
2. **Resolution & Framing:** Exactly 1920 × 1080 without stretching, black bars, or UI clipping.
3. **No Synthetic Mockups:** Recorded directly against the live CARDIA application running on localhost with real Gunicorn / Flask backend inference and real Three.js WebGL rendering.
4. **No Real PHI Exposed:** Profile used is strictly synthetic illustrative test data from the audited benchmark.
5. **Legibility & Pacing:** Captions use high-contrast neo-brutalist styling with `Space Grotesk` and `JetBrains Mono`, perfectly integrated with CARDIA's beige grid visual identity.
