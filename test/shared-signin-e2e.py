"""Signed-in shared sync, end to end, on fictional data only.

The REAL page route and REAL /api/profile route run in development/shared-agenda/test/e2e-harness.mjs
(Node, in-memory SQLite, locally generated signing keys, stubbed Google JWKS). The browser loads them on a
simulated HTTPS origin (https://lifepilot.example.test, served through Playwright request interception), and
Google Identity Services is replaced by a fake script that hands back harness-minted fictional ID tokens.
No live account, Google service, credential, deployment or real profile is used. All other network is blocked.

  LIFEPILOT_BROWSER=chromium python test/shared-signin-e2e.py
"""
import json
import os
from pathlib import Path
import subprocess
import unittest
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "development" / "shared-agenda" / "test" / "e2e-harness.mjs"
ORIGIN = "https://lifepilot.example.test"
KEY = "lifepilot-v02-profile"
TOKEN_PREFIX = "eyJhbGciOiJSUzI1NiIs"  # base64url of '{"alg":"RS256",' — any stored token would contain it
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
FAKE_GIS = """window.google={accounts:{id:{
 initialize(c){window.__gisConfig=c;},
 prompt(){window.__gisPrompts=(window.__gisPrompts||0)+1;
  fetch('/__test/mint').then(r=>r.json()).then(j=>window.__gisConfig.callback(j.credential?{credential:j.credential}:{}));},
 renderButton(){window.__gisButtons=(window.__gisButtons||0)+1;},disableAutoSelect(){}}}};"""


class Harness:
    def __init__(self, *flags):
        self.proc = subprocess.Popen(["node", str(HARNESS), *flags], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        self.base = "http://127.0.0.1:%d" % json.loads(self.proc.stdout.readline())["port"]

    def call(self, path, method="GET", headers=None, body=None, url=None):
        req = urllib.request.Request(self.base + path, data=body, method=method, headers={**(headers or {}), **({"x-test-url": url} if url else {})})
        try:
            with OPENER.open(req, timeout=20) as r:
                return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()

    def control(self, path):
        return json.loads(self.call(path)[2])

    def stop(self):
        self.proc.terminate()
        self.proc.wait(timeout=10)


class SignedInSharedSync(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.harness = Harness()
        cls.playwright = sync_playwright().start()
        cls.engine = os.getenv("LIFEPILOT_BROWSER", "chromium")
        if cls.engine not in ("chromium", "firefox", "webkit"):
            raise ValueError("LIFEPILOT_BROWSER must select chromium, firefox, or webkit")
        args = {"args": ["--no-sandbox"]} if cls.engine == "chromium" else {}
        cls.browser = getattr(cls.playwright, cls.engine).launch(**args)
        print(f"Signed-in shared sync e2e: {cls.engine} {cls.browser.version}", flush=True)
        cls.legacy_row = cls.row("platform-user-legacy")

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.harness.stop()

    @classmethod
    def rows(cls):
        return {r["owner_id"]: r for r in cls.harness.control("/__test/rows")}

    @classmethod
    def row(cls, owner):
        return cls.rows().get(owner)

    def device(self, harness=None, clock=False):
        harness = harness or self.harness
        context = self.browser.new_context(timezone_id="America/Phoenix")
        blocked, gis = [], []

        def block(route):
            blocked.append(route.request.url)
            route.abort()

        def app(route):
            r = route.request
            status, headers, body = harness.call(
                r.url[len(ORIGIN):] or "/", r.method,
                {k: v for k, v in r.headers.items() if k.lower() not in ("host", "content-length")},
                r.post_data_buffer, r.url)
            route.fulfill(status=status, headers={k: v for k, v in headers.items() if k.lower() not in ("content-length", "transfer-encoding", "connection")}, body=body)

        def fake_gis(route):
            gis.append(route.request.url)
            route.fulfill(status=200, content_type="text/javascript", body=FAKE_GIS)

        context.route("**/*", block)
        context.route(ORIGIN + "/**", app)
        context.route("https://accounts.google.com/gsi/client", fake_gis)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("dialog", lambda d: d.accept())
        if clock:
            page.clock.install()
        page.goto(ORIGIN + "/")
        self.addCleanup(context.close)
        self.addCleanup(lambda: self.assertEqual(errors, [], "browser script exceptions"))
        self.addCleanup(lambda: self.assertEqual(blocked, [], "unexpected network outside the simulated origin"))
        return page, gis

    def status(self, page, pattern):
        page.wait_for_function("p => new RegExp(p).test(document.getElementById('sharedStatus').textContent)", arg=pattern, timeout=20000)

    def start_fresh(self, page):
        page.get_by_role("button", name="Start Fresh", exact=True).click()
        page.wait_for_function("profile !== null && !transactionRunning")

    def add_task(self, page, name):
        page.get_by_role("button", name="Today's Agenda", exact=True).click()
        page.get_by_text("Add a task manually", exact=True).click()
        page.locator("#agendaName").fill(name)
        page.locator("#agendaDue").fill("2026-11-12")
        count = page.evaluate("profile?.execution?.tasks?.length || 0")
        page.get_by_role("button", name="Add task", exact=True).click()
        page.wait_for_function("n => profile?.execution?.tasks?.length === n + 1 && !transactionRunning", arg=count)

    def tasks(self, page):
        return [t["name"] for t in page.evaluate("profile?.execution?.tasks || []")]

    def no_token_at_rest(self, page):
        at_rest = page.evaluate("JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie])")
        self.assertNotIn(TOKEN_PREFIX, at_rest)

    def mode(self, m):
        self.harness.control("/__test/mode?mode=" + m)

    def api_log(self):
        return self.harness.control("/__test/api-log")

    # ---- the owner journey, in order ----
    def test_1_owner_journey_two_devices_sync_reload_conflict_recovery(self):
        self.mode("owner")
        a, gis = self.device()
        self.assertTrue(a.evaluate("window.isSecureContext"))
        self.start_fresh(a)
        self.add_task(a, "Fictional task one")
        self.assertEqual(gis, [], "Google script must not load before the owner chooses to connect")
        a.locator("#sharedConnect").click()
        self.status(a, "Synced · revision 1")
        self.assertEqual(gis, ["https://accounts.google.com/gsi/client"])
        owner = self.row("google:fictional-owner-sub-1001")
        self.assertEqual(owner["revision"], 1)
        self.assertEqual([t["name"] for t in json.loads(owner["payload"])["execution"]["tasks"]], ["Fictional task one"])
        self.add_task(a, "Fictional task two")
        self.status(a, "Synced · revision 2")
        self.no_token_at_rest(a)

        # Reload: one silent sign-in, automatic reconnect, nothing re-uploaded.
        puts = sum(1 for e in self.api_log() if e["method"] == "PUT")
        a.reload()
        self.status(a, "Synced · revision 2")
        self.assertEqual(a.evaluate("window.__gisPrompts"), 1)
        self.assertEqual(sum(1 for e in self.api_log() if e["method"] == "PUT"), puts)
        self.assertEqual(self.tasks(a), ["Fictional task one", "Fictional task two"])

        # Second device loads the shared agenda after signing in.
        b, _ = self.device()
        b.locator("#sharedConnect").click()
        b.wait_for_function("profile?.execution?.tasks?.length === 2 && !transactionRunning")
        self.status(b, "Synced · revision 2")

        # Edit on A, refresh on B.
        self.add_task(a, "Fictional task three")
        self.status(a, "Synced · revision 3")
        b.evaluate("sharedCheck()")
        b.wait_for_function("profile?.execution?.tasks?.length === 3")

        # Conflict: both edit from revision 3; B wins the race, A must review, nothing is overwritten.
        self.add_task(b, "Fictional B edit")
        self.status(b, "Synced · revision 4")
        self.add_task(a, "Fictional A edit")
        self.status(a, "Both copies are safe")
        self.assertEqual(self.row("google:fictional-owner-sub-1001")["revision"], 4)
        a.get_by_role("button", name="Keep this device’s copy", exact=True).click()
        self.status(a, "Synced · revision 5")
        final = self.row("google:fictional-owner-sub-1001")
        names = [t["name"] for t in json.loads(final["payload"])["execution"]["tasks"]]
        self.assertIn("Fictional A edit", names)
        self.assertNotIn("Fictional B edit", names)
        self.assertIn("Fictional B edit", final["previous_payload"], "server keeps the replaced copy")
        recovery = json.loads(a.evaluate("k => localStorage.getItem(k + ':shared-conflicts')", KEY))
        self.assertEqual(len(recovery), 1)
        self.assertIn("Fictional B edit", json.dumps(recovery[0]["shared"]))
        self.assertIn("Fictional A edit", json.dumps(recovery[0]["local"]))
        self.no_token_at_rest(a)
        self.no_token_at_rest(b)
        # The pre-upgrade row stored under the old platform identity is untouched (rollback stays possible).
        self.assertEqual(self.row("platform-user-legacy"), self.legacy_row)

    # ---- negative cases: nothing is written, local data is kept ----
    def refused_connect(self, mode, pattern):
        before = self.rows()
        self.mode(mode)
        page, _ = self.device()
        self.start_fresh(page)
        self.add_task(page, "Fictional local only")
        page.locator("#sharedConnect").click()
        self.status(page, pattern)
        self.assertEqual(self.tasks(page), ["Fictional local only"])
        self.assertEqual(self.rows(), before)
        self.no_token_at_rest(page)
        self.mode("owner")
        return page

    def test_2_declined_sign_in_uploads_nothing(self):
        n = len(self.api_log())
        self.refused_connect("none", "Sign in with Google")
        self.assertEqual(len(self.api_log()), n, "no API request without a sign-in")

    def test_3_invalid_tokens_are_refused_by_the_server(self):
        for mode in ("attacker", "wrong-aud"):
            page = self.refused_connect(mode, "Google sign-in expired")
            self.assertFalse(page.evaluate("LifePilotAuth.signedIn()"))
            self.assertEqual(self.api_log()[-1]["status"], 401)

    def test_4_other_google_account_is_forbidden(self):
        self.refused_connect("other", "Shared storage unavailable")
        self.assertEqual(self.api_log()[-1]["status"], 403)

    def test_5_forged_identity_headers_never_authenticate(self):
        before = self.rows()
        page, _ = self.device()
        forged = {"oai-authenticated-user-id": "platform-user-legacy", "oai-authenticated-user-email": "owner@example.test", "content-type": "application/json"}
        statuses = page.evaluate("""async h => [await fetch('/api/profile', {headers: h}).then(r => r.status),
            await fetch('/api/profile', {method: 'PUT', headers: h, body: JSON.stringify({revision: 4, profile: {goals: []}})}).then(r => r.status)]""", forged)
        self.assertEqual(statuses, [401, 401])
        self.assertEqual(self.rows(), before)

    def test_6_expired_sign_in_mid_session_keeps_local_edits(self):
        self.mode("owner")
        page, _ = self.device(clock=True)
        page.locator("#sharedConnect").click()
        page.wait_for_function("profile?.execution?.tasks?.length > 0 && !transactionRunning")
        self.status(page, "Synced")
        before = self.rows()
        page.clock.fast_forward("02:00:00")
        self.assertFalse(page.evaluate("LifePilotAuth.signedIn()"))
        self.add_task(page, "Fictional edit after expiry")
        self.status(page, "sign in with Google to sync")
        self.assertEqual(page.evaluate("sharedPending.execution.tasks.at(-1).name"), "Fictional edit after expiry")
        self.assertFalse(page.locator("#sharedRetry").is_hidden())
        self.assertEqual(self.rows(), before)

    def test_7_jwks_outage_is_unavailable_not_signed_out(self):
        before = self.rows()
        self.mode("rotated")
        self.harness.control("/__test/jwks?down=1")
        try:
            page, _ = self.device()
            self.start_fresh(page)
            page.locator("#sharedConnect").click()
            self.status(page, "Shared storage unavailable")
            self.assertTrue(page.evaluate("LifePilotAuth.signedIn()"), "a Google key outage must not discard the sign-in")
            self.assertEqual(self.api_log()[-1]["status"], 503)
            self.assertEqual(self.rows(), before)
        finally:
            self.harness.control("/__test/jwks?down=0")
            self.mode("owner")


class UnconfiguredHost(unittest.TestCase):
    def test_absent_config_fails_closed_without_loading_google(self):
        harness = Harness("--unconfigured")
        self.addCleanup(harness.stop)
        with sync_playwright() as p:
            engine = os.getenv("LIFEPILOT_BROWSER", "chromium")
            browser = getattr(p, engine).launch(**({"args": ["--no-sandbox"]} if engine == "chromium" else {}))
            try:
                case = SignedInSharedSync("test_1_owner_journey_two_devices_sync_reload_conflict_recovery")
                case.browser, case.harness = browser, harness
                page, gis = case.device(harness)
                self.assertIsNone(page.evaluate("document.querySelector('meta[name=lifepilot-google-client-id]')"))
                case.start_fresh(page)
                page.locator("#sharedConnect").click()
                case.status(page, "not set up")
                self.assertEqual(gis, [])
                self.assertEqual(json.loads(harness.call("/__test/api-log")[2]), [])
                status = page.evaluate("fetch('/api/profile', {headers: {'oai-authenticated-user-id': 'x'}}).then(r => r.status)")
                self.assertEqual(status, 503)
                case.doCleanups()
            finally:
                browser.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
