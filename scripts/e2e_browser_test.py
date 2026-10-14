import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = "/home/purab/.gemini/antigravity-ide/brain/3642ae86-4f38-4fd5-8c0b-eab362b3ac1e/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def run():
    print("[1/5] Launching Chrome via Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )

        # 1. Desktop Test (1440x950)
        context = browser.new_context(viewport={"width": 1440, "height": 950})
        page = context.new_page()

        print("[2/5] Navigating to http://localhost:5173...")
        page.goto("http://localhost:5173", wait_until="networkidle")
        time.sleep(1.5)

        # Select synthetic patient profile (high_multivessel_risk)
        print("[3/5] Selecting synthetic profile high_multivessel_risk...")
        page.select_option("select.sample-select-dropdown", value="high_multivessel_risk")
        time.sleep(1.0)

        # Click [ RUN MULTI-VESSEL ANALYSIS → ]
        print("[4/5] Clicking Run Analysis button...")
        submit_btn = page.locator("button.btn-form-submit")
        submit_btn.click()

        # Wait for inference results to calculate
        page.wait_for_selector(".cad-card .prob-value", timeout=8000)
        time.sleep(1.5)

        # Click LAD vessel dock pill to trigger 3D vessel highlight and inspector card
        print("[5/5] Selecting LAD vessel branch...")
        lad_btn = page.locator("button.vessel-dock-pill", has_text="LAD")
        lad_btn.click()
        time.sleep(1.0)

        # Capture Desktop Analysis Screenshot
        desktop_analysis_path = f"{SCREENSHOTS_DIR}/desktop_analysis_prediction.png"
        page.screenshot(path=desktop_analysis_path)
        print(f"✓ Desktop Analysis screenshot saved to {desktop_analysis_path}")

        # Open Model Evaluation Modal
        eval_btn = page.locator("button.header-action-btn", has_text="MODEL EVALUATION")
        eval_btn.click()
        time.sleep(1.0)
        modal_path = f"{SCREENSHOTS_DIR}/desktop_model_metrics_modal.png"
        page.screenshot(path=modal_path)
        print(f"✓ Model Evaluation Modal screenshot saved to {modal_path}")

        # Close Modal
        close_btn = page.locator("button.modal-close-btn")
        close_btn.click()
        time.sleep(0.5)

        context.close()

        # 2. Mobile Tests (390x844 iPhone 14 style)
        print("Testing Mobile Responsiveness (390x844)...")
        mobile_context = browser.new_context(viewport={"width": 390, "height": 844})
        mobile_page = mobile_context.new_page()
        mobile_page.goto("http://localhost:5173", wait_until="networkidle")
        time.sleep(1.5)

        # Load sample profile on mobile
        mobile_page.select_option("select.sample-select-dropdown", value="high_multivessel_risk")
        time.sleep(0.5)

        # Capture Mobile Tab 1: Form Input
        mobile_form_path = f"{SCREENSHOTS_DIR}/mobile_tab_01_input.png"
        mobile_page.screenshot(path=mobile_form_path)
        print(f"✓ Mobile Tab 1 saved to {mobile_form_path}")

        # Switch to Tab 2: 3D Atlas
        mobile_page.locator("button.mobile-nav-tab", has_text="02 ATLAS").click()
        time.sleep(1.0)
        mobile_atlas_path = f"{SCREENSHOTS_DIR}/mobile_tab_02_atlas.png"
        mobile_page.screenshot(path=mobile_atlas_path)
        print(f"✓ Mobile Tab 2 saved to {mobile_atlas_path}")

        # Run Analysis and switch to Tab 3: Results
        mobile_page.locator("button.mobile-nav-tab", has_text="01 INPUT").click()
        time.sleep(0.5)
        mobile_page.locator("button.btn-form-submit").click()
        mobile_page.wait_for_selector(".cad-card .prob-value", timeout=8000)
        time.sleep(1.0)

        # Mobile auto-navigates to results on prediction
        mobile_results_path = f"{SCREENSHOTS_DIR}/mobile_tab_03_results.png"
        mobile_page.screenshot(path=mobile_results_path)
        print(f"✓ Mobile Tab 3 saved to {mobile_results_path}")

        mobile_context.close()
        browser.close()
        print("All E2E tests and screenshots captured successfully!")

if __name__ == "__main__":
    run()
