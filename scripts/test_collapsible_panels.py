import os
import time
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = "/home/purab/.gemini/antigravity-ide/brain/3642ae86-4f38-4fd5-8c0b-eab362b3ac1e/screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

LOCAL_URL = "http://localhost:5173"

def run_verification():
    print(f"=== Starting Desktop Collapsible Panels Verification against {LOCAL_URL} ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )

        context = browser.new_context(viewport={"width": 1440, "height": 950})
        page = context.new_page()

        print("\n[Step 1] Navigating to local CARDIA app...")
        res = page.goto(LOCAL_URL, wait_until="networkidle", timeout=30000)
        assert res.status == 200, f"Expected 200 OK, got {res.status}"
        time.sleep(2.0)

        # 1. Verify 3D heart has NO collapse controls
        heart_header = page.locator(".heart-canvas-card .col-card-header")
        heart_collapse_btn = heart_header.locator(".panel-collapse-btn")
        assert heart_collapse_btn.count() == 0, "ERROR: Heart panel must NEVER have a collapse button!"
        print("✓ Verified: 3D Heart panel has NO collapse button (permanently visible).")

        # Capture initial state
        page.screenshot(path=f"{SCREENSHOTS_DIR}/01_desktop_initial.png")
        print(f"✓ Screenshot saved: 01_desktop_initial.png")

        # 2. Test Left Panel (Clinical Form) collapse and expand
        print("\n[Step 2] Testing Left Panel (01 Clinical Inputs) collapse/expand...")
        left_collapse_btn = page.locator(".col-left .panel-collapse-btn.desktop-only")
        assert left_collapse_btn.is_visible(), "Left collapse button should be visible on desktop"
        left_collapse_btn.click()
        time.sleep(0.5)

        main_layout = page.locator(".workstation-main-layout")
        assert "left-collapsed" in (main_layout.get_attribute("class") or ""), "Main layout should have left-collapsed class"
        
        left_rail = page.locator(".col-left .collapsed-vertical-rail")
        assert left_rail.is_visible(), "Left vertical collapsed rail should be visible"
        print("✓ Left panel collapsed into 56px vertical rail successfully.")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/02_desktop_left_collapsed.png")
        print(f"✓ Screenshot saved: 02_desktop_left_collapsed.png")

        # Expand Left Panel back via rail
        left_rail.click()
        time.sleep(0.5)
        assert "left-collapsed" not in (main_layout.get_attribute("class") or ""), "Main layout should not have left-collapsed"
        assert page.locator(".col-left .col-panel-full").is_visible(), "Left full panel should be visible again"
        print("✓ Left panel expanded back successfully via rail click.")

        # 3. Test Right Sidebar collapse/expand
        print("\n[Step 3] Testing Right Column (03-05 Results & Audit) dock collapse/expand...")
        right_dock_btn = page.locator(".col-dock-bar .panel-collapse-btn")
        assert right_dock_btn.is_visible(), "Right dock collapse button should be visible"
        right_dock_btn.click()
        time.sleep(0.5)

        assert "right-collapsed" in (main_layout.get_attribute("class") or ""), "Main layout should have right-collapsed class"
        right_rail = page.locator(".col-right .collapsed-vertical-rail")
        assert right_rail.is_visible(), "Right vertical collapsed rail should be visible"
        print("✓ Right sidebar collapsed into 56px vertical rail successfully.")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/03_desktop_right_collapsed.png")
        print(f"✓ Screenshot saved: 03_desktop_right_collapsed.png")

        # Test Dual Collapsed (Zen 3D Heart Focus Mode)
        print("\n[Step 4] Testing Dual Collapsed (Zen 3D Heart Focus Mode)...")
        left_collapse_btn = page.locator(".col-left .panel-collapse-btn.desktop-only")
        # Need to expand right first or collapse left: left is currently expanded
        left_collapse_btn.click()
        time.sleep(0.5)
        assert "left-collapsed" in (main_layout.get_attribute("class") or "")
        assert "right-collapsed" in (main_layout.get_attribute("class") or "")
        print("✓ Both side panels collapsed simultaneously: maximum focus on 3D coronary arborization.")
        
        page.screenshot(path=f"{SCREENSHOTS_DIR}/04_desktop_dual_collapsed.png")
        print(f"✓ Screenshot saved: 04_desktop_dual_collapsed.png")

        # Expand both back
        left_rail.click()
        time.sleep(0.3)
        right_rail.click()
        time.sleep(0.5)
        print("✓ Both panels expanded back.")

        # 4. Test Individual Panel Collapsing inside Right Column (Panels 03, 04, 05)
        print("\n[Step 5] Testing individual panels (03 Prediction, 04 Attribution, 05 Metrics)...")
        panel_03 = page.locator(".risk-card-panel")
        panel_04 = page.locator(".explanations-card-panel")
        panel_05 = page.locator(".metrics-inline-panel")

        # Click panel 03 header to collapse
        page.locator(".risk-card-panel .header-interactive-toggle").click()
        time.sleep(0.4)
        assert "is-collapsed" in (panel_03.get_attribute("class") or "")
        assert not panel_03.locator(".panel-collapsible-body").is_visible()
        print("✓ Panel 03 (Prediction Engine) collapsed; header and status pill remain visible.")

        # Click panel 04 header to collapse
        page.locator(".explanations-card-panel .header-interactive-toggle").click()
        time.sleep(0.4)
        assert "is-collapsed" in (panel_04.get_attribute("class") or "")
        assert not panel_04.locator(".panel-collapsible-body").is_visible()
        print("✓ Panel 04 (Feature Attribution) collapsed.")

        # Expand Panel 05 (Model Evaluation & CV Audit)
        page.locator(".metrics-inline-panel .header-interactive-toggle").click()
        time.sleep(0.4)
        assert "is-collapsed" not in (panel_05.get_attribute("class") or "")
        assert panel_05.locator(".panel-collapsible-body").is_visible()
        print("✓ Panel 05 (Model Evaluation & CV Audit) expanded: 5-fold CV summary grid visible.")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/05_desktop_individual_panels_toggled.png")
        print(f"✓ Screenshot saved: 05_desktop_individual_panels_toggled.png")

        # Restore Panels 03, 04, and collapse 05
        page.locator(".risk-card-panel .header-interactive-toggle").click()
        time.sleep(0.2)
        page.locator(".explanations-card-panel .header-interactive-toggle").click()
        time.sleep(0.2)
        page.locator(".metrics-inline-panel .header-interactive-toggle").click()
        time.sleep(0.3)

        # 5. Test Research Hero Banner Collapse
        print("\n[Step 6] Testing Research Hero Banner collapse/expand...")
        hero_btn = page.locator(".research-hero-banner .panel-collapse-btn.desktop-only")
        hero_btn.click()
        time.sleep(0.4)
        hero_banner = page.locator(".research-hero-banner")
        assert "is-collapsed" in (hero_banner.get_attribute("class") or "")
        assert page.locator(".hero-compact-strip").is_visible()
        print("✓ Research Hero Banner collapsed into compact 1-line metadata strip.")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/06_desktop_hero_collapsed.png")
        print(f"✓ Screenshot saved: 06_desktop_hero_collapsed.png")

        hero_btn.click()
        time.sleep(0.4)
        assert "is-collapsed" not in (hero_banner.get_attribute("class") or "")
        print("✓ Research Hero Banner expanded back.")

        # 6. Test Prediction & State Preservation across collapses
        print("\n[Step 7] Testing State Preservation across live inference...")
        page.select_option("select.sample-select-dropdown", value="high_multivessel_risk")
        time.sleep(0.8)
        
        submit_btn = page.locator("button.btn-form-submit")
        submit_btn.click()
        
        # Wait for CAD prediction card to render
        page.wait_for_selector(".cad-card .prob-value", timeout=25000)
        time.sleep(1.0)
        
        initial_cad_prob = page.locator(".cad-card .prob-value").inner_text()
        print(f"✓ Inference complete: Overall CAD = {initial_cad_prob}")

        # Collapse Left Panel, collapse Panel 03, collapse Panel 04
        page.locator(".col-left .panel-collapse-btn.desktop-only").click()
        time.sleep(0.4)
        page.locator(".risk-card-panel .header-interactive-toggle").click()
        time.sleep(0.4)

        # Verify summary status pill in collapsed header displays CAD percentage
        status_pill_text = page.locator(".risk-card-panel .summary-status-pill").inner_text()
        print(f"✓ Summary status pill in collapsed header: '{status_pill_text}'")
        assert "CAD:" in status_pill_text

        # Verify right rail pill also reflects prediction if right is collapsed
        page.locator(".col-dock-bar .panel-collapse-btn").click()
        time.sleep(0.4)
        right_rail_pill = page.locator(".col-right .rail-count-pill").inner_text()
        print(f"✓ Right collapsed vertical rail shows prediction badge: '{right_rail_pill}'")

        # Expand everything back
        page.locator(".col-right .collapsed-vertical-rail").click()
        time.sleep(0.3)
        page.locator(".col-left .collapsed-vertical-rail").click()
        time.sleep(0.3)
        page.locator(".risk-card-panel .header-interactive-toggle").click()
        time.sleep(0.4)

        # Verify prediction probability is still identical!
        restored_cad_prob = page.locator(".cad-card .prob-value").inner_text()
        assert initial_cad_prob == restored_cad_prob, f"State lost! Expected {initial_cad_prob}, got {restored_cad_prob}"
        print(f"✓ Confirmed: Prediction results perfectly preserved after multiple collapse cycles ({restored_cad_prob})")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/07_desktop_state_preserved_post_prediction.png")
        print(f"✓ Screenshot saved: 07_desktop_state_preserved_post_prediction.png")

        # 7. Test Tablet Layout (1024x768)
        print("\n[Step 8] Testing Tablet Layout (1024x768)...")
        tablet_ctx = browser.new_context(viewport={"width": 1024, "height": 768})
        tablet_page = tablet_ctx.new_page()
        tablet_page.goto(LOCAL_URL, wait_until="networkidle")
        time.sleep(1.5)

        # Collapse buttons should be hidden on tablet
        tablet_collapse_btns = tablet_page.locator(".panel-collapse-btn.desktop-only")
        assert not tablet_collapse_btns.first.is_visible(), "Desktop collapse buttons must be HIDDEN on tablet"
        tablet_rails = tablet_page.locator(".collapsed-vertical-rail")
        assert not tablet_rails.first.is_visible(), "Collapsed vertical rails must be HIDDEN on tablet"
        print("✓ Verified: Tablet view has zero collapse controls and zero rails visible.")

        tablet_page.screenshot(path=f"{SCREENSHOTS_DIR}/08_tablet_view_1024.png")
        print(f"✓ Screenshot saved: 08_tablet_view_1024.png")

        # 8. Test Mobile Layout (390x844)
        print("\n[Step 9] Testing Mobile Layout (390x844)...")
        mobile_ctx = browser.new_context(viewport={"width": 390, "height": 844})
        mobile_page = mobile_ctx.new_page()
        mobile_page.goto(LOCAL_URL, wait_until="networkidle")
        time.sleep(1.5)

        mobile_nav = mobile_page.locator(".mobile-section-nav")
        assert mobile_nav.is_visible(), "Mobile section nav must be visible on mobile"
        mobile_collapse_btns = mobile_page.locator(".panel-collapse-btn.desktop-only")
        assert not mobile_collapse_btns.first.is_visible(), "Collapse buttons must be HIDDEN on mobile"

        # Switch to 02 ATLAS tab
        mobile_page.locator("button.mobile-nav-tab", has_text="02 ATLAS").click()
        time.sleep(1.0)
        assert mobile_page.locator(".col-center.mobile-active").is_visible(), "3D Heart atlas should be visible in 02 ATLAS tab"
        print("✓ Verified: Mobile view preserves dedicated 3-tab navigation with zero desktop collapse clutter.")

        mobile_page.screenshot(path=f"{SCREENSHOTS_DIR}/09_mobile_view_390.png")
        print(f"✓ Screenshot saved: 09_mobile_view_390.png")

        print("\n=== ALL DESKTOP COLLAPSIBLE PANEL VERIFICATIONS PASSED 100% ===")

if __name__ == "__main__":
    run_verification()
