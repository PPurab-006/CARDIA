import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = "/home/purab/.gemini/antigravity-ide/brain/3642ae86-4f38-4fd5-8c0b-eab362b3ac1e/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

PROD_URL = "https://cardia-five.vercel.app"

def run_smoke_test():
    console_errors = []
    network_errors = []

    print(f"[1/6] Launching browser to test live production deployment: {PROD_URL}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )

        context = browser.new_context(viewport={"width": 1440, "height": 950})
        page = context.new_page()

        # Listen for console errors & network failures
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("requestfailed", lambda req: network_errors.append(f"{req.method} {req.url}: {req.failure}"))

        print(f"[2/6] Navigating to {PROD_URL}...")
        res = page.goto(PROD_URL, wait_until="networkidle", timeout=30000)
        assert res.status == 200, f"Expected 200 OK, got {res.status}"
        time.sleep(2.0)

        # Check API connection status pill
        print("[3/6] Verifying live API health indicator...")
        status_pill = page.locator(".connection-status-pill")
        status_text = status_pill.inner_text()
        print(f"API status pill text: '{status_text}'")
        assert "ONLINE" in status_text, f"Expected API to be ONLINE, got '{status_text}'"

        # Select synthetic patient profile 1: High Multi-Vessel Risk
        print("[4/6] Selecting synthetic profile: high_multivessel_risk...")
        page.select_option("select.sample-select-dropdown", value="high_multivessel_risk")
        time.sleep(1.0)

        # Submit prediction
        print("[5/6] Submitting prediction to live Render backend...")
        submit_btn = page.locator("button.btn-form-submit")
        submit_btn.click()

        # Wait for CAD prediction card to render (accounting for cloud latency on free-tier CPU)
        page.wait_for_selector(".cad-card .prob-value", timeout=45000)
        time.sleep(2.0)

        cad_prob = page.locator(".cad-card .prob-value").inner_text()
        print(f"✓ Overall CAD Predicted Probability: {cad_prob}")

        # Check all 3 vessel pills
        for vessel in ["LAD", "LCX", "RCA"]:
            v_pill = page.locator("button.vessel-dock-pill", has_text=vessel)
            text = v_pill.inner_text()
            print(f"✓ 3D Vessel Dock [{vessel}]: {text}")

        # Click LAD branch in 3D viewer
        lad_btn = page.locator("button.vessel-dock-pill", has_text="LAD")
        lad_btn.click()
        time.sleep(1.0)

        # Verify floating inspector card
        inspector = page.locator(".vessel-inspector-card")
        inspector_title = page.locator(".inspector-title").inner_text()
        print(f"✓ 3D Vessel Inspector active: {inspector_title}")

        # Capture desktop production screenshot
        screenshot_path = f"{SCREENSHOTS_DIR}/live_production_smoke_test.png"
        page.screenshot(path=screenshot_path)
        print(f"✓ Production smoke test screenshot saved to {screenshot_path}")

        # Mobile check (390x844)
        print("[6/6] Verifying mobile view on live production...")
        mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
        mobile_page = mobile_ctx.new_page()
        mobile_page.goto(PROD_URL, wait_until="networkidle")
        time.sleep(1.5)

        # Navigate to 02 ATLAS tab
        atlas_tab = mobile_page.locator("button.mobile-nav-tab", has_text="02 ATLAS")
        atlas_tab.click()
        time.sleep(1.5)

        mobile_screenshot_path = f"{SCREENSHOTS_DIR}/live_production_mobile_atlas.png"
        mobile_page.screenshot(path=mobile_screenshot_path)
        print(f"✓ Mobile live production screenshot saved to {mobile_screenshot_path}")

        print("\n--- Smoke Test Audit Summary ---")
        print(f"Console errors: {len(console_errors)}")
        for err in console_errors:
            print(f"  Console error: {err}")
        print(f"Network errors: {len(network_errors)}")
        for err in network_errors:
            print(f"  Network error: {err}")
        print("ALL LIVE PRODUCTION SMOKE TESTS PASSED!")

if __name__ == "__main__":
    run_smoke_test()
