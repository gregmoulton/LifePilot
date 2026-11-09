"""Deploy-safety gate: upgrade, rollback and isolation on an HTTPS origin (fictional data only).
Usage: python3 preview/upgrade_gate.py <repo_dir>

Models a GitHub Pages release where PR #101 replaces the current production build at the
SAME HTTPS origin, so the new code opens the profile the production build wrote. Checks:
  1. Opening the new build writes nothing (stored bytes and key set unchanged).
  2. All production goals, decisions, execution records and unknown fields survive,
     and the first save keeps the production bytes as the last-good backup.
     An approved commitment (#95) created by the new build survives rollback.
  3. Rolling back to the production build still reads the profile, and its saves keep
     the new Agenda data; rolling forward again works.
  4. The owner-test preview on a different origin sees none of it and cannot change it.
Production snapshot: preview/fixtures/production-main/ (main at 4710a5e).
Exits nonzero if any check fails or the run crashes.
"""
import sys, os, json, shutil, ssl, subprocess, tempfile, threading, http.server, functools
from playwright.sync_api import sync_playwright

repo = os.path.abspath(sys.argv[1])
APP = ["index.html", "execution.js", "storage.js", "forward-radar.js", "agenda-model.js", "agenda.js", "commitments.js", "persistence.js"]
PROD = os.path.join(repo, "preview", "fixtures", "production-main")
KEY = "lifepilot-v02-profile"
tmp = tempfile.mkdtemp(prefix="lp-upgrade-")
site = os.path.join(tmp, "site")
ok = []


def check(name, cond, detail=""):
    cond = bool(cond); ok.append(cond)
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))


def deploy(files_from, names):
    """Replace the served site in place, as a static-host release does (same origin)."""
    shutil.rmtree(site, ignore_errors=True); os.makedirs(site)
    for n in names: shutil.copy(os.path.join(files_from, n), os.path.join(site, n))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()

    def log_message(self, *a):
        pass


def https_server(directory, cert, key):
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(NoCache, directory=directory))
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cert, key)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def storage(pg):
    return pg.evaluate("Object.fromEntries([...Array(localStorage.length).keys()].map(i=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]))")


servers = []
try:
    cert, key = os.path.join(tmp, "c.pem"), os.path.join(tmp, "k.pem")
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert,
                    "-days", "1", "-subj", "/CN=localhost"], check=True, capture_output=True)
    prod_srv = https_server(site, cert, key); servers.append(prod_srv)
    origin = f"https://localhost:{prod_srv.server_port}/index.html"
    preview_dir = os.path.join(tmp, "preview")
    subprocess.run([sys.executable, os.path.join(repo, "preview", "build.py"), preview_dir], check=True, capture_output=True)
    prev_srv = https_server(preview_dir, cert, key); servers.append(prev_srv)
    preview_url = f"https://localhost:{prev_srv.server_port}/index.html"

    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(ignore_https_errors=True, viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.set_default_timeout(10000)

        def open_app():
            pg.goto(origin); pg.wait_for_load_state("networkidle")

        # --- 1. Current production build creates a populated fictional profile.
        deploy(PROD, ["index.html", "execution.js"]); open_app()
        check("Production origin is HTTPS and a secure context", origin.startswith("https://") and pg.evaluate("isSecureContext"))
        pg.get_by_role("button", name="Start Fresh").first.click()
        for name, actions in [("Fictional: Learn Spanish", "Book a tutor\nDaily flashcards"), ("Fictional: Run a 10K", "Buy shoes")]:
            pg.evaluate("showTab('goals')"); pg.get_by_role("button", name="+ Add Goal").click()
            pg.fill("#goalName", name); pg.fill("#goalActions", actions); pg.get_by_role("button", name="Save Goal").click()
        pg.evaluate("showTab('decisions')"); pg.fill("#decisionText", "Fictional: study before work")
        pg.locator("#decisionText").evaluate("e=>e.form.requestSubmit()")
        pg.evaluate("showTab('execution')")
        pg.fill("#programName", "Fictional program"); pg.fill("#milestoneName", "Fictional milestone"); pg.fill("#milestoneTarget", "Fictional test")
        pg.locator("#programName").evaluate("e=>e.form.requestSubmit()")
        pg.fill("#taskName", "Fictional production task"); pg.fill("#taskDue", "2030-01-15T09:00"); pg.fill("#taskMinutes", "30")
        pg.locator("#taskName").evaluate("e=>e.form.requestSubmit()")
        # Fields this release does not know about must survive (older/other-agent data).
        pg.evaluate("""k=>{const p=JSON.parse(localStorage.getItem(k));p.fictional_unknown_top={keep:true};
            p.goals[0].fictional_unknown_goal_field='keep me';localStorage.setItem(k,JSON.stringify(p))}""", KEY)
        before = storage(pg); prod_bytes = before.get(KEY)
        prod = json.loads(prod_bytes or "{}")
        check("Production build saved a populated profile",
              len(prod.get("goals", [])) == 2 and len(prod.get("decision_register", [])) == 1 and len(prod.get("execution", {}).get("tasks", [])) == 1)

        # --- 2. Release PR #101 to the same origin; opening must write nothing.
        deploy(repo, APP); open_app()
        check("New build: opening writes nothing (bytes and keys unchanged)", storage(pg) == before)
        check("New build: saving is enabled (no storage warning, Web Locks)",
              pg.evaluate("!!navigator.locks") and pg.locator("#storageWarning").is_hidden())
        pg.evaluate("showTab('goals')")
        goals_text = pg.locator("#app").inner_text()
        check("New build shows both production goals", "Fictional: Learn Spanish" in goals_text and "Fictional: Run a 10K" in goals_text)
        pg.evaluate("showTab('decisions')")
        check("New build shows the production decision", "Fictional: study before work" in pg.locator("#app").inner_text())
        pg.evaluate("showTab('agenda')")
        check("New build's Agenda shows the production task", "Fictional production task" in pg.locator("#agendaWorkspace").inner_text())
        pg.fill("#agendaName", "Fictional new-build task"); pg.get_by_role("button", name="Today", exact=True).click()
        pg.locator("#agendaName").evaluate("e=>e.form.requestSubmit()")
        pg.wait_for_function("k=>(localStorage.getItem(k)||'').includes('Fictional new-build task')", arg=KEY)
        first_save = storage(pg)
        # Commitment Contracts (#95): an approved commitment must survive rollback and roll-forward.
        pg.evaluate("""() => commitmentAction({type:'create', commitment_id:'fc-1', terms:{goal_id: profile.goals[0].id,
            target:{kind:'tasks_completed', count:2}, timezone:'America/Phoenix', starts_on:'2030-01-07',
            reward:'Fictional reward', consequence:'Fictional consequence', cap:'Fictional cap'}})""")
        pg.wait_for_function("!transactionRunning")
        pg.evaluate("() => commitmentAction({type:'approve', commitment_id:'fc-1', approved:true})")
        pg.wait_for_function("!transactionRunning")
        after = storage(pg); new = json.loads(after[KEY])
        check("New build saved an approved fictional commitment",
              [i["status"] for i in new.get("commitments", {}).get("items", [])] == ["active"])
        check("First new-build save keeps production bytes as last-good backup", first_save.get(KEY + ":last-good") == prod_bytes)
        check("Production goals unchanged by the new build", new["goals"] == prod["goals"])
        check("Production decisions unchanged by the new build", new["decision_register"] == prod["decision_register"])
        check("Production execution records kept",
              all(k in new["execution"] and all(r in new["execution"][k] for r in v) for k, v in prod["execution"].items()))
        check("Unknown fields kept", new.get("fictional_unknown_top") == {"keep": True} and new["goals"][0].get("fictional_unknown_goal_field") == "keep me")

        # --- 3. Roll back to the production build.
        deploy(PROD, ["index.html", "execution.js"]); errs.clear(); open_app()
        pg.evaluate("showTab('goals')")
        check("Rollback: production build reads the profile", "Fictional: Learn Spanish" in pg.locator("#app").inner_text() and not errs, "; ".join(errs))
        pg.evaluate("showTab('decisions')"); pg.fill("#decisionText", "Fictional: decision made after rollback")
        pg.locator("#decisionText").evaluate("e=>e.form.requestSubmit()")
        rolled = json.loads(storage(pg)[KEY])
        check("Rollback save keeps commitments and their history unchanged", rolled.get("commitments") == new.get("commitments"))
        check("Rollback save keeps the new build's Agenda task and metadata",
              any(t.get("name") == "Fictional new-build task" for t in rolled["execution"]["tasks"]) and rolled.get("agenda") == new.get("agenda"))

        # --- 4. Roll forward again.
        deploy(repo, APP); errs.clear(); before2 = storage(pg); open_app()
        check("Roll forward: opening writes nothing", storage(pg) == before2)
        pg.evaluate("showTab('decisions')")
        check("Roll forward: decision made during rollback is shown", "Fictional: decision made after rollback" in pg.locator("#app").inner_text())
        pg.evaluate("showTab('agenda')")
        check("Roll forward: commitments readable by the new build",
              pg.evaluate("() => LifePilotCommitments.scorecard(profile, 'fc-1').length === 0 && profile.commitments.items[0].status === 'active'"))
        check("Roll forward: Agenda tasks shown and saving enabled",
              "Fictional new-build task" in pg.locator("#agendaWorkspace").inner_text() and pg.locator("#storageWarning").is_hidden() and not errs, "; ".join(errs))

        # --- 5. Owner-test preview on another origin is isolated from production.
        prod_state = storage(pg)
        pv = ctx.new_page(); pv.on("dialog", lambda d: d.accept())
        pv.goto(preview_url); pv.wait_for_load_state("networkidle")
        check("Preview origin sees no production data", storage(pv) == {} and pv.get_by_role("button", name="Start Fresh").first.is_visible())
        pv.get_by_role("button", name="Start Fresh").first.click(); pv.evaluate("showTab('agenda')")
        pv.fill("#agendaName", "Fictional preview task"); pv.get_by_role("button", name="Today", exact=True).click()
        pv.locator("#agendaName").evaluate("e=>e.form.requestSubmit()")
        pv.wait_for_function("k=>(localStorage.getItem(k)||'').includes('Fictional preview task')", arg=KEY)
        open_app()
        check("Preview use leaves production storage byte-for-byte unchanged", storage(pg) == prod_state)
        b.close()
except Exception as e:  # a crash is a failure, never a pass
    check(f"Run completed without error ({type(e).__name__}: {e})", False)
finally:
    for s in servers: s.shutdown()
    shutil.rmtree(tmp, ignore_errors=True)

if os.environ.get("LIFEPILOT_UPGRADE_NEGATIVE_CONTROL") == "1":
    check("Negative control (deliberately false)", False)
print(f"{sum(ok)}/{len(ok)} passed")
sys.exit(0 if ok and all(ok) else 1)
