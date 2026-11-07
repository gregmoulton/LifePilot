"""Owner-preview smoke test (fictional data only).
Usage: python3 preview/preview_test.py <built_preview_dir>
Exits nonzero if any check fails. Set LIFEPILOT_PREVIEW_NEGATIVE_CONTROL=1 to add one
deliberately false check; the run must then exit nonzero (proves the gate can fail).
"""
import sys, os, threading, http.server, functools
from playwright.sync_api import sync_playwright, expect


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


d = sys.argv[1]
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=d))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://localhost:{srv.server_port}/index.html"
ok = []


def check(n, c):
    c = bool(c); ok.append(c); print(("PASS " if c else "FAIL ") + n)


def settled(assertion, *a, **k):
    """Wait (up to 5 s) for the app to re-render; True if the assertion holds."""
    try:
        assertion(*a, timeout=5000, **k); return True
    except AssertionError:
        return False


STORED_HOLD = "[...Array(localStorage.length).keys()].some(i=>(localStorage.getItem(localStorage.key(i))||'').includes('\"agenda_hold\":true'))"


try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); native = []; errs = []; pg.set_default_timeout(10000)
        pg.on("dialog", lambda dl: (native.append(dl.message), dl.dismiss())); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_load_state("networkidle")
        bar = pg.locator("#previewDialog"); card = lambda n: pg.locator("#agendaWorkspace article", has_text=n)
        check("Preview banner visible", pg.locator("#previewBanner").is_visible())
        pg.get_by_role("button", name="Start Fresh").first.click(); pg.evaluate("showTab('agenda')")
        for n in ["Fictional A", "Fictional B"]:
            pg.fill("#agendaName", n); pg.get_by_role("button", name="Today", exact=True).click(); pg.locator("#agendaName").evaluate("e=>e.form.requestSubmit()")
        card("Fictional A").locator("button[data-action='complete']").click()
        check("Minutes bar shown instead of native prompt", settled(expect(bar).to_be_visible))
        # Tap the box and type, as a person would: the default 0 must be replaced, not kept as "020".
        pg.tap("#previewDialogInput"); pg.keyboard.type("20")
        check("Typing replaces the default 0", pg.locator("#previewDialogInput").input_value() == "20")
        pg.get_by_role("button", name="Continue").click()
        check("Minutes bar closes after Continue", settled(expect(bar).to_be_hidden))
        check("Fictional A completed with 20 min", settled(expect(card("Fictional A")).to_contain_text, "20 actual min"))
        # A second complete must ask again: no answer from Fictional A may leak into it.
        card("Fictional B").locator("button[data-action='complete']").click()
        check("Second complete asks again (bar visible)", settled(expect(bar).to_be_visible))
        check("Second prompt is fresh (no leaked 20)", pg.locator("#previewDialogInput").input_value() != "20")
        bar.get_by_role("button", name="Cancel").click()
        check("Bar closes after Cancel", settled(expect(bar).to_be_hidden))
        check("Cancelled complete leaves Fictional B open", settled(expect(card("Fictional B")).to_contain_text, "planned"))
        card("Fictional B").locator("button[data-action='hold']").click()
        check("Fictional B moved to HOLD", settled(expect(card("Fictional B").locator("button[data-action='release']")).to_be_visible))
        check("No bar left open after HOLD", bar.is_hidden())
        pg.wait_for_function(STORED_HOLD, timeout=5000)
        pg.reload(); pg.wait_for_load_state("networkidle"); pg.evaluate("showTab('agenda')")
        t = pg.locator("#agendaWorkspace").inner_text()
        check("Completed task saved with 20 min after reload", "Fictional A" in t[t.find("Completed"):] and "20 actual min" in t)
        check("Held task in HOLD after reload", "Fictional B" in t[t.find("HOLD"):t.find("Needs review")])
        check("Saving enabled (Web Locks available)", pg.evaluate("!!navigator.locks"))
        check("No native dialogs fired", not native); check("No JS errors", not errs)
        if os.environ.get("LIFEPILOT_PREVIEW_NEGATIVE_CONTROL") == "1":
            check("Negative control (deliberately false)", False)
        pg.screenshot(path=os.path.join(d, "..", "preview_shot.png"), full_page=False)
        b.close()
except Exception as e:  # a crash is a failure, never a pass
    check(f"Run completed without error ({type(e).__name__}: {e})", False)
finally:
    srv.shutdown()
print(f"{sum(ok)}/{len(ok)} passed")
sys.exit(0 if ok and all(ok) else 1)
