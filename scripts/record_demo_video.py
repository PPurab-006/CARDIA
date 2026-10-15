import os
import sys
import time
import math
import subprocess
from playwright.sync_api import sync_playwright

PROJECT_ROOT = "/home/purab/Purab/Projects/competitions/multimodal cardio"
DEMO_DIR = os.path.join(PROJECT_ROOT, "demo")
RAW_DIR = os.path.join(DEMO_DIR, "raw_capture")
OUTPUT_MP4 = os.path.join(DEMO_DIR, "CARDIA_Demo.mp4")
THUMBNAIL_PATH = os.path.join(DEMO_DIR, "CARDIA_Thumbnail.png")
SHOTLIST_PATH = os.path.join(DEMO_DIR, "SHOT_LIST.md")

os.makedirs(DEMO_DIR, exist_ok=True)
os.makedirs(RAW_DIR, exist_ok=True)

def ease_in_out(t):
    return 0.5 * (1 - math.cos(math.pi * t))

def smooth_move(page, start_x, start_y, end_x, end_y, duration=0.8, steps=30):
    delay = duration / steps
    for i in range(1, steps + 1):
        t = i / steps
        factor = ease_in_out(t)
        cur_x = start_x + (end_x - start_x) * factor
        cur_y = start_y + (end_y - start_y) * factor
        page.mouse.move(cur_x, cur_y)
        time.sleep(delay)

def get_element_center(locator):
    box = locator.bounding_box()
    if not box:
        raise ValueError("Element bounding box not found")
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

def set_caption(page, step_badge, caption_text):
    page.evaluate("""({ badge, text }) => {
        const el = document.getElementById('demo-caption-banner');
        if (!el) return;
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, 8px)';
        setTimeout(() => {
            el.innerHTML = `
                <span style="background: #D4FF00; color: #0A0A0A; border: 2px solid #0A0A0A; padding: 3px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; white-space: nowrap; box-shadow: 2px 2px 0px #0A0A0A;">${badge}</span>
                <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 700; color: #0A0A0A; line-height: 1.3;">${text}</span>
            `;
            el.style.opacity = '1';
            el.style.transform = 'translate(-50%, 0)';
        }, 180);
    }""", {"badge": step_badge, "text": caption_text})

def hide_caption(page):
    page.evaluate("""() => {
        const el = document.getElementById('demo-caption-banner');
        if (el) el.style.opacity = '0';
    }""")

def run_recording():
    print("[1/7] Initializing 1920x1080 headless browser session with video capture...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--window-size=1920,1080"
            ]
        )

        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            record_video_dir=RAW_DIR,
            record_video_size={"width": 1920, "height": 1080}
        )

        page = context.new_page()

        print("[2/7] Loading CARDIA workstation at http://localhost:5173...")
        page.goto("http://localhost:5173", wait_until="networkidle")
        time.sleep(2.0)

        # Inject Virtual Cursor and Styling Overlays
        page.evaluate("""() => {
            // 1. Virtual Mouse Cursor (Acid-Yellow Neo-Brutalist Pointer)
            const cursor = document.createElement('div');
            cursor.id = 'demo-virtual-cursor';
            cursor.style.cssText = `
                position: fixed;
                width: 20px;
                height: 20px;
                background-color: #D4FF00;
                border: 2.5px solid #0A0A0A;
                border-radius: 50%;
                box-shadow: 2px 2px 0px #0A0A0A;
                pointer-events: none;
                z-index: 1000000;
                transform: translate(-50%, -50%);
                transition: transform 0.1s ease, background-color 0.1s ease;
                left: 960px;
                top: 540px;
            `;
            document.body.appendChild(cursor);

            window.addEventListener('mousemove', (e) => {
                cursor.style.left = e.clientX + 'px';
                cursor.style.top = e.clientY + 'px';
            });
            window.addEventListener('mousedown', () => {
                cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
                cursor.style.backgroundColor = '#FF1A53';
            });
            window.addEventListener('mouseup', () => {
                cursor.style.transform = 'translate(-50%, -50%) scale(1)';
                cursor.style.backgroundColor = '#D4FF00';
            });

            // 2. Neo-Brutalist Micro-Caption Lower-Third
            const captionBox = document.createElement('div');
            captionBox.id = 'demo-caption-banner';
            captionBox.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translate(-50%, 0);
                background-color: #FFFFFF;
                border: 2.5px solid #0A0A0A;
                box-shadow: 4px 4px 0px #0A0A0A;
                padding: 10px 20px;
                z-index: 999990;
                display: flex;
                align-items: center;
                gap: 12px;
                max-width: 960px;
                opacity: 0;
                transition: opacity 0.25s ease, transform 0.25s ease;
                pointer-events: none;
            `;
            document.body.appendChild(captionBox);

            // 3. Opening & Closing Fullscreen Cards Container
            const titleOverlay = document.createElement('div');
            titleOverlay.id = 'demo-title-overlay';
            titleOverlay.style.cssText = `
                position: fixed;
                inset: 0;
                background-color: #F4F1EA;
                background-image: 
                    linear-gradient(to right, rgba(30, 25, 20, 0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(30, 25, 20, 0.08) 1px, transparent 1px);
                background-size: 32px 32px;
                background-position: center center;
                z-index: 9999999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 1;
                transition: opacity 0.8s ease;
            `;
            titleOverlay.innerHTML = `
                <div style="background: #FFFFFF; border: 4px solid #0A0A0A; box-shadow: 8px 8px 0px #0A0A0A; padding: 48px 64px; max-width: 920px; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: #D4FF00; border: 2px solid #0A0A0A; padding: 4px 14px; margin-bottom: 24px; box-shadow: 3px 3px 0px #0A0A0A;">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 800; letter-spacing: 0.1em; color: #0A0A0A;">MULTIMODAL AI HACKATHON 2026 // TRACK A</span>
                    </div>
                    <h1 style="font-family: 'Space Grotesk', sans-serif; font-size: 72px; font-weight: 800; letter-spacing: -0.04em; color: #0A0A0A; margin: 0 0 12px 0; line-height: 1.0;">CARDIA</h1>
                    <div style="font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700; color: #1E293B; margin-bottom: 20px; letter-spacing: -0.01em;">
                        Cardiovascular Risk Intelligence
                    </div>
                    <p style="font-family: 'Inter', sans-serif; font-size: 16px; color: #475569; max-width: 680px; margin: 0 auto 32px; line-height: 1.5;">
                        AI-powered multi-vessel stenosis prediction (CAD, LAD, LCX, RCA) with interactive 3D coronary arborization from 54 clinical covariates.
                    </p>
                    <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
                        <span style="background: #F4F1EA; border: 1.5px solid #0A0A0A; padding: 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #0A0A0A;">UCI-411 COHORT (n=303)</span>
                        <span style="background: #F4F1EA; border: 1.5px solid #0A0A0A; padding: 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #0A0A0A;">BODYPARTS3D FMA7088</span>
                        <span style="background: #F4F1EA; border: 1.5px solid #0A0A0A; padding: 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #0A0A0A;">ZERO LEAKAGE AUDITED</span>
                    </div>
                </div>
            `;
            document.body.appendChild(titleOverlay);
        }""")

        cur_x, cur_y = 960, 540
        page.mouse.move(cur_x, cur_y)

        # -------------------------------------------------------------
        # SCENE 1: OPENING TITLE (0:00 - 0:05, 5 seconds)
        # -------------------------------------------------------------
        print("[3/7] Recording Scene 1: Opening Title...")
        time.sleep(4.5)

        # Fade out title overlay to reveal workstation
        page.evaluate("""() => {
            const el = document.getElementById('demo-title-overlay');
            if (el) {
                el.style.opacity = '0';
                setTimeout(() => el.style.display = 'none', 850);
            }
        }""")
        time.sleep(1.0)

        # -------------------------------------------------------------
        # SCENE 2: WORKSTATION OVERVIEW (0:05 - 0:17, 12 seconds)
        # -------------------------------------------------------------
        print("[4/7] Recording Scene 2: Architecture & Research Metadata...")
        set_caption(page, "01 // WORKSTATION", "CARDIA: Integrated clinical AI decision workstation with real-time API health telemetry.")
        time.sleep(1.5)

        # Move cursor to Header Brand & API Status
        hdr_brand = page.locator(".brand-title-row")
        bx, by = get_element_center(hdr_brand)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.8)
        cur_x, cur_y = bx, by
        time.sleep(1.5)

        status_pill = page.locator(".connection-status-pill")
        bx, by = get_element_center(status_pill)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.7)
        cur_x, cur_y = bx, by
        time.sleep(1.5)

        # Move to Research Hero Metadata Strip
        set_caption(page, "01 // COHORT & AUDIT", "Trained on the Z-Alizadeh Sani cohort (n=303, UCI-411) with rigorous leakage elimination.")
        meta_chip = page.locator(".metadata-chip").first
        bx, by = get_element_center(meta_chip)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.8)
        cur_x, cur_y = bx, by
        time.sleep(2.5)

        # -------------------------------------------------------------
        # SCENE 3: PATIENT COVARIATES & INPUT TABS (0:17 - 0:31, 14 seconds)
        # -------------------------------------------------------------
        print("[5/7] Recording Scene 3: Synthetic Patient Input...")
        set_caption(page, "02 // CLINICAL COVARIATES", "Loading high multi-vessel risk profile across 54 schema-validated multimodal covariates.")
        
        # Navigate to Synthetic Profile Selector
        picker = page.locator("select.sample-select-dropdown")
        bx, by = get_element_center(picker)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.8)
        cur_x, cur_y = bx, by
        time.sleep(0.4)
        
        # Click dropdown and select Profile 1
        page.mouse.down()
        time.sleep(0.1)
        page.mouse.up()
        picker.select_option("high_multivessel_risk")
        time.sleep(1.2)

        # Cycle through categories to show breadth of covariates
        tabs = [
            ("#cat-tab-history", "Patient medical history: Diabetes, Hypertension, and Smoker status."),
            ("#cat-tab-symptoms", "Clinical presentation: Typical chest pain and dyspnea profile."),
            ("#cat-tab-ecg", "Electrocardiogram metrics: ST depression, elevation, and T-wave inversions."),
            ("#cat-tab-labs", "Comprehensive laboratory panel: FBS, Triglycerides, LDL, HDL, and BUN."),
            ("#cat-tab-echo", "Echocardiography: Ejection fraction (EF-TTE: 35%) & Regional Wall Motion.")
        ]

        for tab_id, desc in tabs:
            tab_loc = page.locator(tab_id)
            bx, by = get_element_center(tab_loc)
            smooth_move(page, cur_x, cur_y, bx, by, duration=0.45)
            cur_x, cur_y = bx, by
            page.mouse.down()
            time.sleep(0.08)
            page.mouse.up()
            set_caption(page, "02 // MULTIMODAL DATA", desc)
            time.sleep(1.3)

        # -------------------------------------------------------------
        # SCENE 4: 3D ANATOMICAL CORONARY ARBORIZATION (0:31 - 0:50, 19 seconds)
        # -------------------------------------------------------------
        print("[6/7] Recording Scene 4: 3D Coronary Anatomy...")
        set_caption(page, "03 // 3D ATLAS", "BodyParts3D FMA7088 heart mesh with warm beige technical grid and selectable coronary tree.")
        
        # Move cursor to 3D Heart Canvas
        canvas_loc = page.locator(".canvas-container canvas")
        c_box = canvas_loc.bounding_box()
        heart_cx = c_box["x"] + c_box["width"] * 0.52
        heart_cy = c_box["y"] + c_box["height"] * 0.48
        
        smooth_move(page, cur_x, cur_y, heart_cx, heart_cy, duration=0.8)
        cur_x, cur_y = heart_cx, heart_cy
        time.sleep(0.6)

        # Smooth interactive 3D rotation via mouse drag
        set_caption(page, "03 // INTERACTION", "Real-time 3D orbital manipulation allows full inspection of anterior and posterior vasculature.")
        page.mouse.down()
        for i in range(1, 28):
            page.mouse.move(heart_cx + i * 5.5, heart_cy - math.sin(i * 0.15) * 8)
            time.sleep(0.03)
        page.mouse.up()
        cur_x = heart_cx + 27 * 5.5
        time.sleep(1.0)

        # Select LAD Branch
        set_caption(page, "03 // CORONARY BRANCHES", "Selecting LAD (Left Anterior Descending) illuminates the vessel and displays anatomical territory.")
        lad_pill = page.locator("button.vessel-dock-pill", has_text="LAD")
        bx, by = get_element_center(lad_pill)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.7)
        cur_x, cur_y = bx, by
        page.mouse.down()
        time.sleep(0.08)
        page.mouse.up()
        time.sleep(2.0)

        # Select LCX Branch
        set_caption(page, "03 // CORONARY BRANCHES", "Selecting LCX (Left Circumflex) highlights lateral ventricular supply territory.")
        lcx_pill = page.locator("button.vessel-dock-pill", has_text="LCX")
        bx, by = get_element_center(lcx_pill)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.5)
        cur_x, cur_y = bx, by
        page.mouse.down()
        time.sleep(0.08)
        page.mouse.up()
        time.sleep(1.8)

        # Select RCA Branch
        set_caption(page, "03 // CORONARY BRANCHES", "Selecting RCA (Right Coronary Artery) highlights inferior wall perfusion.")
        rca_pill = page.locator("button.vessel-dock-pill", has_text="RCA")
        bx, by = get_element_center(rca_pill)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.5)
        cur_x, cur_y = bx, by
        page.mouse.down()
        time.sleep(0.08)
        page.mouse.up()
        time.sleep(1.8)

        # Toggle Cardiac Pulse Motion
        set_caption(page, "03 // DYNAMICS", "Physiological cardiac contraction cycle simulates dual-stage ventricular ejection.")
        pulse_btn = page.locator("button.viewer-btn:has-text('PULSE')")
        bx, by = get_element_center(pulse_btn)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.6)
        cur_x, cur_y = bx, by
        page.mouse.down()
        time.sleep(0.08)
        page.mouse.up()
        time.sleep(2.5)

        # -------------------------------------------------------------
        # SCENE 5: MULTI-TARGET PREDICTION EXECUTION (0:50 - 1:05, 15 seconds)
        # -------------------------------------------------------------
        print("[7/7] Recording Scene 5: Multi-Target Prediction Engine...")
        set_caption(page, "04 // INFERENCE ENGINE", "Executing multi-target ML inference: Overall CAD + vessel-specific stenosis (>=50% narrowing).")
        
        # Navigate to Run Analysis button
        run_btn = page.locator("button.btn-form-submit")
        bx, by = get_element_center(run_btn)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.8)
        cur_x, cur_y = bx, by
        time.sleep(0.3)
        page.mouse.down()
        time.sleep(0.1)
        page.mouse.up()

        # Wait for results to compute
        page.wait_for_selector(".cad-card .prob-value", timeout=10000)
        time.sleep(1.0)

        # Move to Primary CAD Result Card
        set_caption(page, "04 // PRIMARY RESULT", "Overall CAD: 94.6% probability (HIGH STENOSIS LIKELIHOOD, RandomForest CV ROC-AUC: 0.928).")
        cad_card = page.locator(".cad-card")
        bx, by = get_element_center(cad_card)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.8)
        cur_x, cur_y = bx, by
        time.sleep(3.0)

        # Move to Secondary Vessel Results
        set_caption(page, "04 // VESSEL BREAKDOWN", "Vessel-specific risks: LAD 96.5% (High), LCX 67.2% (High), RCA 88.6% (High) mapped to anatomy.")
        vessel_card = page.locator(".vessel-card").first
        bx, by = get_element_center(vessel_card)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.7)
        cur_x, cur_y = bx, by
        time.sleep(3.0)

        # -------------------------------------------------------------
        # SCENE 6: TREE-SHAP ATTRIBUTION & MODEL EVALUATION (1:05 - 1:21, 16 seconds)
        # -------------------------------------------------------------
        print("Recording Scene 6: Transparency & Model Audit...")
        set_caption(page, "05 // EXPLAINABILITY", "Local TreeSHAP attributions identify key clinical drivers: RWMA, Patient Age, and Chest Pain.")
        
        shap_panel = page.locator(".explanations-card-panel")
        bx, by = get_element_center(shap_panel)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.7)
        cur_x, cur_y = bx, by
        time.sleep(2.5)

        # Switch to LAD SHAP Target
        lad_shap_tab = page.locator("button.toggle-pill:has-text('[LAD]')")
        bx, by = get_element_center(lad_shap_tab)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.5)
        cur_x, cur_y = bx, by
        page.mouse.down()
        time.sleep(0.08)
        page.mouse.up()
        set_caption(page, "05 // VESSEL ATTRIBUTION", "Target-specific TreeSHAP isolates distinct morphological risk drivers for the LAD branch.")
        time.sleep(2.5)

        # Open Model Evaluation Modal
        set_caption(page, "05 // AUDITED METRICS", "Full Stratified 5-Fold Cross-Validation evaluation audit with model selection rationales.")
        eval_btn = page.locator("button.header-action-btn:has-text('MODEL EVALUATION')")
        bx, by = get_element_center(eval_btn)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.8)
        cur_x, cur_y = bx, by
        page.mouse.down()
        time.sleep(0.08)
        page.mouse.up()
        time.sleep(3.5)

        # Close Modal
        close_btn = page.locator("button.modal-close-btn")
        bx, by = get_element_center(close_btn)
        smooth_move(page, cur_x, cur_y, bx, by, duration=0.5)
        cur_x, cur_y = bx, by
        page.mouse.down()
        time.sleep(0.08)
        page.mouse.up()
        time.sleep(1.0)

        # -------------------------------------------------------------
        # SCENE 7: CLOSING TITLE & STATUTORY DISCLAIMER (1:21 - 1:30, 9 seconds)
        # -------------------------------------------------------------
        print("Recording Scene 7: Closing Frame & Clinical Disclaimer...")
        hide_caption(page)

        # Show Closing Overlay
        page.evaluate("""() => {
            const closing = document.createElement('div');
            closing.id = 'demo-closing-overlay';
            closing.style.cssText = `
                position: fixed;
                inset: 0;
                background-color: #F4F1EA;
                background-image: 
                    linear-gradient(to right, rgba(30, 25, 20, 0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(30, 25, 20, 0.08) 1px, transparent 1px);
                background-size: 32px 32px;
                background-position: center center;
                z-index: 9999999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.8s ease;
            `;
            closing.innerHTML = `
                <div style="background: #FFFFFF; border: 4px solid #0A0A0A; box-shadow: 8px 8px 0px #0A0A0A; padding: 44px 60px; max-width: 900px; text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: #D4FF00; border: 2px solid #0A0A0A; padding: 4px 12px; margin-bottom: 20px; box-shadow: 3px 3px 0px #0A0A0A;">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 800; color: #0A0A0A;">MULTIMODAL AI HACKATHON 2026 // TRACK A</span>
                    </div>
                    <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 56px; font-weight: 800; letter-spacing: -0.03em; color: #0A0A0A; margin: 0 0 10px 0; line-height: 1.1;">CARDIA</h2>
                    <div style="font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700; color: #334155; margin-bottom: 24px;">
                        Transparent Predictions &bull; Interactive 3D Anatomy &bull; Research Workstation
                    </div>
                    
                    <div style="background: #FEF2F2; border: 2px solid #DC2626; padding: 18px 24px; margin-bottom: 24px; text-align: left; box-shadow: 3px 3px 0px #0A0A0A;">
                        <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 800; color: #DC2626; margin-bottom: 6px; letter-spacing: 0.05em;">
                            [ STATUTORY NOTICE // NON-DIAGNOSTIC PROTO ]
                        </div>
                        <p style="font-family: 'Inter', sans-serif; font-size: 13.5px; color: #450A0A; line-height: 1.5; margin: 0;">
                            Educational and research decision-support prototype only. Model predictions are statistical likelihood estimates derived from cross-validation and do not constitute a clinical diagnosis, medical directive, or substitute for formal invasive coronary angiography (ICA / CCTA).
                        </p>
                    </div>

                    <div style="display: flex; justify-content: center; gap: 24px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #64748B;">
                        <span>DATASET: UCI-411 (Z-Alizadeh Sani)</span>
                        <span>3D MESH: BodyParts3D (CC BY-SA 2.1 JP)</span>
                        <span>LIVE DEMO: cardia-five.vercel.app</span>
                    </div>
                </div>
            `;
            document.body.appendChild(closing);
            setTimeout(() => closing.style.opacity = '1', 50);
        }""")
        time.sleep(7.0)

        print("Recording sequence completed. Closing page and exporting raw video stream...")
        page.close()
        context.close()
        browser.close()

    # Find the recorded WebM file
    webm_files = [os.path.join(RAW_DIR, f) for f in os.listdir(RAW_DIR) if f.endswith(".webm")]
    if not webm_files:
        raise RuntimeError("No recorded WebM video found in " + RAW_DIR)
    
    # Sort by mtime to get the latest
    latest_webm = max(webm_files, key=os.path.getmtime)
    print(f"✓ Raw capture complete: {latest_webm} ({os.path.getsize(latest_webm)} bytes)")

    # -------------------------------------------------------------
    # POST-PROCESSING: ENCODE TO BROADLY COMPATIBLE H.264 MP4
    # -------------------------------------------------------------
    print(f"Encoding finalized 1920x1080 30FPS MP4 to {OUTPUT_MP4}...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", latest_webm,
        "-vf", "scale=1920:1080:flags=lanczos,fps=30",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        OUTPUT_MP4
    ]
    subprocess.run(ffmpeg_cmd, check=True)
    print(f"✓ Video successfully encoded: {OUTPUT_MP4}")

    # Generate YouTube-Ready Thumbnail from Representative Prediction Frame
    print(f"Generating thumbnail to {THUMBNAIL_PATH}...")
    thumb_cmd = [
        "ffmpeg", "-y",
        "-ss", "00:00:58",
        "-i", OUTPUT_MP4,
        "-vframes", "1",
        "-q:v", "2",
        THUMBNAIL_PATH
    ]
    subprocess.run(thumb_cmd, check=True)
    print(f"✓ Thumbnail extracted: {THUMBNAIL_PATH}")

    # Write Shot List and Timing Breakdown
    shot_list_content = """# CARDIA Hackathon Demo Video — Timing Breakdown & Shot List

- **Target Duration:** 75–110 seconds
- **Rendered Video:** `demo/CARDIA_Demo.mp4`
- **Resolution:** 1920 × 1080 (Full HD) @ 30 FPS
- **Video Codec:** H.264 (High Profile, YUV420p, CRF 18, Web-Optimized FastStart)
- **Audio:** Silent (Voiceless, on-screen neo-brutalist captions)

## Shot List & Sequence

| Timestamp | Duration | Scene Description | On-Screen Caption |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:05** | 5.0s | **Opening Title Screen**: Oversized CARDIA typography, competition track badge, and dataset metadata. | Fullscreen title card |
| **0:05 – 0:17** | 12.0s | **Workstation Overview**: Header telemetry (`SYS.API // ONLINE`), research ribbon (`UCI-411`, `n=303`, `54 Covariates`, `Stratified 5-Fold CV`). | `[ 01 // WORKSTATION ]` Real-time API telemetry and research provenance. |
| **0:17 – 0:31** | 14.0s | **Synthetic Patient Input**: Selects Profile 1 (High Multi-Vessel Risk), cycles across clinical categories (History, Symptoms, ECG, Labs, Echo). | `[ 02 // MULTIMODAL DATA ]` 54 multimodal covariates across clinical categories. |
| **0:31 – 0:50** | 19.0s | **3D Coronary Arborization**: Interactive 3D heart orbit, independent selection of LAD, LCX, and RCA branches, floating inspector, and cardiac contraction pulse. | `[ 03 // 3D ATLAS ]` BodyParts3D FMA7088 heart with selectable LAD, LCX, and RCA branches. |
| **0:50 – 1:05** | 15.0s | **Multi-Target Prediction Engine**: Submits prediction, shows Overall CAD (94.6% High Stenosis Likelihood), vessel stenosis breakdowns, and dynamic risk recoloring. | `[ 04 // PREDICTION ENGINE ]` Multi-target ML predicting overall CAD + vessel-specific stenosis. |
| **1:05 – 1:21** | 16.0s | **Explainability & Model Audit**: Local TreeSHAP contributions (RWMA, Age, Chest Pain), target switching, and the Stratified 5-Fold Cross-Validation evaluation modal. | `[ 05 // EXPLAINABILITY ]` TreeSHAP local attributions & audited 5-fold cross-validation metrics. |
| **1:21 – 1:29** | 8.0s | **Closing Title & Statutory Disclaimer**: Non-diagnostic statutory clinical notice, dataset attribution, and live deployment link. | Fullscreen closing frame |

**Total Runtime:** ~89 seconds (within the 75–110s range).
"""
    with open(SHOTLIST_PATH, "w") as f:
        f.write(shot_list_content)
    print(f"✓ Shot list written to {SHOTLIST_PATH}")

if __name__ == "__main__":
    run_recording()
