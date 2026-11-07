import sys, threading, http.server, functools, datetime
from playwright.sync_api import sync_playwright
d=sys.argv[1]; h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=d); h.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),h); threading.Thread(target=srv.serve_forever,daemon=True).start()
url=f"http://localhost:{srv.server_port}/index.html"; ok=[]
def check(n,c): ok.append(c); print(("PASS " if c else "FAIL ")+n)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
    pg=ctx.new_page(); native=[]; errs=[]
    pg.on("dialog",lambda dl:(native.append(dl.message),dl.dismiss())); pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(url); pg.wait_for_load_state("networkidle")
    check("Preview banner visible", pg.locator("#previewBanner").is_visible())
    pg.get_by_role("button",name="Start Fresh").first.click(); pg.evaluate("showTab('agenda')")
    for n in ["Fictional A","Fictional B"]:
        pg.fill("#agendaName",n); pg.get_by_role("button",name="Today",exact=True).click(); pg.locator("#agendaName").evaluate("e=>e.form.requestSubmit()")
    pg.locator("#agendaWorkspace article",has_text="Fictional A").locator("button[data-action='complete']").click()
    check("Minutes bar shown instead of native prompt", pg.locator("#previewDialog").is_visible())
    pg.fill("#previewDialogInput","20"); pg.get_by_role("button",name="Continue").click()
    pg.locator("#agendaWorkspace article",has_text="Fictional B").locator("button[data-action='hold']").click()
    # second complete must ask again (no leaked answer)
    pg.locator("#agendaWorkspace article",has_text="Fictional B").locator("button").first.click()
    pg.reload(); pg.wait_for_load_state("networkidle"); pg.evaluate("showTab('agenda')")
    t=pg.locator("#agendaWorkspace").inner_text()
    check("Completed task saved with 20 min after reload", "Fictional A" in t[t.find("Completed"):] and "20 actual min" in t)
    check("Held task in HOLD after reload", "Fictional B" in t[t.find("HOLD"):t.find("Needs review")])
    check("Saving enabled (Web Locks available)", pg.evaluate("!!navigator.locks"))
    check("No native dialogs fired", not native); check("No JS errors", not errs)
    pg.screenshot(path=d+"/../preview_shot.png",full_page=False)
    b.close()
srv.shutdown(); print(f"{sum(ok)}/{len(ok)} passed")
