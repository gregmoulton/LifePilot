"""Owner-style acceptance run with fictional data only.
Usage: python3 e2e_acceptance.py <app_dir> <out_dir>
Serves app_dir on localhost, drives a phone-sized Chromium, and reports PASS/FAIL per check.
"""
import sys, threading, http.server, functools, datetime, json, os
from playwright.sync_api import sync_playwright

app_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=app_dir)
handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://localhost:{srv.server_port}/index.html"

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))

today = datetime.date.today()
yesterday = (today - datetime.timedelta(days=1)).isoformat()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("dialog", lambda d: d.accept("15") if d.type == "prompt" else d.accept())

    page.goto(url); page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Start Fresh").first.click()

    # Goal (fictional)
    page.evaluate("showTab('goals')"); page.get_by_role("button", name="+ Add Goal").click()
    page.fill("#goalName", "Fictional: Run a 10K")
    page.fill("#goalActions", "Buy running shoes")
    page.get_by_role("button", name="Save Goal").click()
    # Decision (fictional)
    page.evaluate("showTab('decisions')"); page.fill("#decisionText", "Fictional: train three days a week")
    page.locator("#decisionText").evaluate("e=>e.form.requestSubmit()")

    # Agenda tasks
    page.evaluate("showTab('agenda')")
    def add_task(name, due=""):
        page.fill("#agendaName", name); page.fill("#agendaDue", due)
        page.locator("#agendaName").evaluate("e=>e.form.requestSubmit()")
    add_task("Fictional overdue task", yesterday)
    add_task("Fictional active task", today.isoformat())
    add_task("Fictional task to hold", today.isoformat())
    add_task("Fictional task to complete", today.isoformat())
    add_task("Fictional unscheduled idea")

    def act(task_name, action):
        art = page.locator("#agendaWorkspace article", has_text=task_name).first
        art.locator(f"button[data-action='{action}']").first.click()
    act("Fictional task to hold", "hold")
    act("Fictional task to complete", "complete")
    page.screenshot(path=f"{out_dir}/1-today-before-reload.png", full_page=True)
    ws = page.locator("#agendaWorkspace").inner_text()

    # Reopen: reload + brand-new tab in same browser profile
    page.reload(); page.wait_for_load_state("networkidle")
    page2 = ctx.new_page(); page2.on("dialog", lambda d: d.accept()); page2.goto(url); page2.wait_for_load_state("networkidle")
    page2.evaluate("showTab('agenda')")
    ws2 = page2.locator("#agendaWorkspace").inner_text()
    page2.screenshot(path=f"{out_dir}/2-today-after-reopen.png", full_page=True)
    prof = json.loads(page2.evaluate("localStorage.getItem('lifepilot-v02-profile')"))

    def section(text, title):
        # text between a section heading and the next heading
        i = text.find(title)
        return text[i:i+600] if i >= 0 else ""
    check("Profile survives reopen (goal)", any(g.get("name") == "Fictional: Run a 10K" for g in prof["goals"]))
    check("Profile survives reopen (decision)", any("three days" in (d.get("decision") or "") for d in prof.get("decision_register", [])))
    for name in ["Fictional overdue task", "Fictional active task", "Fictional task to hold", "Fictional task to complete", "Fictional unscheduled idea"]:
        check(f"Task visible after reopen: {name}", name in ws2)
    check("Overdue task flagged as Carryover", "Carryover" in ws2)
    check("HOLD section contains held task", "Fictional task to hold" in section(ws2, "Hold") or "Fictional task to hold" in section(ws2, "HOLD"), ws2[:800])
    check("Completed section contains completed task", "Fictional task to complete" in section(ws2, "Completed"), ws2[:800])
    check("No JavaScript errors", not errors, "; ".join(errors[:3]))
    check("No horizontal scroll at 390px", page2.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"))
    open(f"{out_dir}/agenda-text.txt", "w").write(ws2)
    b.close()
srv.shutdown()
fails = [r for r in results if not r[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} checks passed")
sys.exit(1 if fails else 0)
