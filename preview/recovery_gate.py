"""Gate: recovery from a realistic populated backup (fictional data only).
Usage: python3 recovery_gate.py <app_dir>
Builds a large fictional profile through the app's own import path, damages the saved copy,
then recovers with "Restore previous backup" and with a backup file, checking every record survives.
"""
import sys, threading, http.server, functools, json, datetime, os, tempfile
from playwright.sync_api import sync_playwright

d = sys.argv[1]
h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=d); h.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h); threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://localhost:{srv.server_port}/index.html"
KEY = "lifepilot-v02-profile"
res = []
def check(n, c, x=""): res.append(bool(c)); print(("PASS " if c else "FAIL ") + n + ("" if c else " — " + str(x)[:300]))

today = datetime.date.today()
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(accept_downloads=True); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda dl: dl.accept("25") if dl.type == "prompt" else dl.accept())
    pg.goto(url); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Start Fresh").first.click()

    # Templates made by the app itself, so the shape is exactly what the app writes.
    pg.evaluate("showTab('goals')"); pg.get_by_role("button", name="+ Add Goal").click()
    pg.fill("#goalName", "Fictional template goal"); pg.fill("#goalActions", "Template action")
    pg.get_by_role("button", name="Save Goal").click()
    pg.evaluate("showTab('decisions')"); pg.fill("#decisionText", "Fictional template decision")
    pg.locator("#decisionText").evaluate("e=>e.form.requestSubmit()")
    pg.evaluate("showTab('agenda')")
    pg.fill("#agendaName", "Fictional template task"); pg.get_by_role("button", name="Today", exact=True).click()
    pg.locator("#agendaName").evaluate("e=>e.form.requestSubmit()")
    pg.wait_for_function("k=>{try{const p=JSON.parse(localStorage.getItem(k));return p.execution?.tasks?.length>0&&p.goals.length>0&&p.decision_register?.length>0}catch{return false}}", arg=KEY, timeout=10000)
    base = json.loads(pg.evaluate("k=>localStorage.getItem(k)", KEY))

    # Inflate to a realistic size: 40 goals, 60 decisions, 400 tasks across every agenda state.
    g0, dec0 = base["goals"][0], base["decision_register"][0]
    t0 = base["execution"]["tasks"][0]
    big = json.loads(json.dumps(base))
    big["goals"] = [dict(json.loads(json.dumps(g0)), id=f"fg-{i}", name=f"Fictional goal {i}") for i in range(40)]
    # The app-recorded decision is kept: an ordinary import must not drop or change existing decisions.
    big["decision_register"] = [dec0] + [dict(json.loads(json.dumps(dec0)), id=f"fd-{i}", decision=f"Fictional decision {i}") for i in range(59)]
    tasks = []
    for i in range(400):
        t = json.loads(json.dumps(t0)); t["id"] = f"ft-{i}"; t["name"] = f"Fictional task {i}"
        kind = i % 5
        t["due"] = {0: (today - datetime.timedelta(days=1 + i % 9)).isoformat(), 1: today.isoformat(),
                    2: "", 3: (today + datetime.timedelta(days=1 + i % 20)).isoformat(), 4: today.isoformat()}[kind]
        if kind == 4: t["agenda_hold"] = True
        tasks.append(t)
    big["execution"]["tasks"] = tasks
    big_text = json.dumps(big)
    pg.evaluate("t=>importFile({text:async()=>t})", big_text); pg.wait_for_timeout(500)
    imported = json.loads(pg.evaluate("k=>localStorage.getItem(k)", KEY))
    check("Large fictional profile saved through the app's import path",
          len(imported["goals"]) == 40 and len(imported["decision_register"]) == 60 and len(imported["execution"]["tasks"]) == 400,
          (len(imported["goals"]), len(imported.get("decision_register", [])), len(imported["execution"]["tasks"])))
    print(f"  profile size: {len(pg.evaluate('k=>localStorage.getItem(k)', KEY)) / 1024:.0f} KB")

    # One more normal change, so the populated profile becomes the "previous backup".
    pg.evaluate("showTab('agenda')"); pg.fill("#agendaName", "Fictional newest task")
    pg.get_by_role("button", name="Today", exact=True).click(); pg.locator("#agendaName").evaluate("e=>e.form.requestSubmit()")
    pg.wait_for_timeout(300)
    last_good = pg.evaluate("k=>localStorage.getItem(k+':last-good')", KEY)
    check("Previous backup holds the populated profile", last_good and len(json.loads(last_good)["execution"]["tasks"]) == 400)
    current = pg.evaluate("k=>localStorage.getItem(k)", KEY)

    # Damage the saved copy the way an interrupted write would.
    damaged = current[: len(current) // 2]
    pg.evaluate("([k,v])=>localStorage.setItem(k,v)", [KEY, damaged]); pg.reload(); pg.wait_for_load_state("networkidle")
    check("Damaged profile blocks the app instead of starting empty",
          pg.locator("text=could not be read").count() > 0 or pg.locator("[onclick*=\"exportRecovery\"]").count() > 0)
    with pg.expect_download() as dl:
        pg.locator("[onclick*=\"exportRecovery('stored')\"]").first.click()
    path = dl.value.path()
    check("Recovery download contains the damaged bytes exactly", open(path, encoding="utf-8").read() == damaged)

    # Path 1: Restore previous backup.
    pg.get_by_role("button", name="Restore previous backup").first.click(); pg.wait_for_timeout(500)
    restored = json.loads(pg.evaluate("k=>localStorage.getItem(k)", KEY))
    check("Restore previous backup brings back all 40 goals, 60 decisions, 400 tasks",
          json.dumps(restored, sort_keys=True) == json.dumps(json.loads(last_good), sort_keys=True))
    check("Damaged bytes kept as a separate recovery copy", pg.evaluate("k=>localStorage.getItem(k+':recovery-original')", KEY) == damaged)
    pg.reload(); pg.wait_for_load_state("networkidle"); pg.evaluate("showTab('agenda')")
    ws = pg.locator("#agendaWorkspace").inner_text()
    check("After reload the agenda shows restored work in every section",
          all(s in ws for s in ["Carryover", "HOLD", "Unscheduled", "Upcoming"]) and "Fictional task 1" in ws, ws[:400])

    # Second recovery on the same device (formerly impossible): works, and both damaged copies are kept.
    pg.evaluate("([k,v])=>localStorage.setItem(k,v)", [KEY, "{broken"]); pg.reload(); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name="Restore previous backup").first.click(); pg.evaluate("transactionQueue"); pg.wait_for_timeout(300)
    second = pg.evaluate("k=>localStorage.getItem(k)", KEY)
    check("Second recovery on same device succeeds", second != "{broken" and len(json.loads(second)["execution"]["tasks"]) == 400)
    hist = json.loads(pg.evaluate("k=>localStorage.getItem(k+':recovery-history')", KEY) or "[]")
    check("Both damaged copies kept in recovery history", [e["bytes"] for e in hist] == [damaged, "{broken"], [e["bytes"][:20] for e in hist])
    pg.reload(); pg.wait_for_load_state("networkidle")
    check("Recovery history survives reload", len(json.loads(pg.evaluate("k=>localStorage.getItem(k+':recovery-history')", KEY))) == 2)

    # Path 2: restore from a backup file, on a device with no earlier recovery.
    tmp = tempfile.mkdtemp(); fpath = os.path.join(tmp, "LifePilot_backup_fictional.json")
    open(fpath, "w", encoding="utf-8").write(current)
    ctx2 = b.new_context(); pg2 = ctx2.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.on("dialog", lambda dl: dl.accept())
    pg2.goto(url); pg2.evaluate("([k,v])=>localStorage.setItem(k,v)", [KEY, current[:len(current)//3]])
    pg2.reload(); pg2.wait_for_load_state("networkidle")
    file_inputs = pg2.locator("input[type=file][onchange*='restoreLocalBackup']")
    check("Backup-file restore is offered while blocked", file_inputs.count() > 0)
    if file_inputs.count():
        file_inputs.first.set_input_files(fpath); pg2.wait_for_timeout(1500)
        after = pg2.evaluate("k=>localStorage.getItem(k)", KEY)
        ok = False
        try: ok = json.dumps(json.loads(after), sort_keys=True) == json.dumps(json.loads(current), sort_keys=True)
        except Exception: pass
        check("Restore from backup file brings back the full populated profile exactly", ok, after[:120] if after else after)
        pg2.reload(); pg2.wait_for_load_state("networkidle")
        check("File-restored profile survives reload", pg2.evaluate("k=>JSON.parse(localStorage.getItem(k)).execution.tasks.length", KEY) == 401)
    check("No JavaScript errors", not errs, errs[:2])
    b.close()
srv.shutdown(); print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)
