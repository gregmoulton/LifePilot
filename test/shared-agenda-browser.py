"""Current shared Agenda candidate browser smoke tests on fictional data only.

Run after pip install playwright and python -m playwright install <browser>:
  LIFEPILOT_BROWSER=chromium python test/shared-agenda-browser.py
No live account, API token, or external deployment is used.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import tempfile
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CANDIDATE = ROOT / "development" / "shared-agenda"
KEY = "lifepilot-v02-profile"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class CurrentTipBrowserSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = tempfile.TemporaryDirectory(prefix="lifepilot-agenda-browser-")
        site = Path(cls.fixture.name)
        shutil.copyfile(CANDIDATE / "app" / "legacy.html", site / "index.html")
        for script in (CANDIDATE / "public").glob("*.js"):
            shutil.copyfile(script, site / script.name)
        cls.server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(site))
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://localhost:{cls.server.server_port}/"
        cls.playwright = sync_playwright().start()
        cls.engine = os.getenv("LIFEPILOT_BROWSER", "chromium")
        if cls.engine not in ("chromium", "firefox", "webkit"):
            raise ValueError("LIFEPILOT_BROWSER must select chromium, firefox, or webkit")
        args = {"args": ["--no-sandbox"]} if cls.engine == "chromium" else {}
        cls.browser = getattr(cls.playwright, cls.engine).launch(**args)
        print(f"Current-tip shared Agenda: {cls.engine} {cls.browser.version}", flush=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.fixture.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(
            timezone_id="America/Phoenix", accept_downloads=True
        )
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.page.get_by_role("button", name="Start Fresh", exact=True).click()
        self.wait_saved()
        self.page.get_by_role("button", name="Today's Agenda", exact=True).click()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], "Unexpected browser script exceptions")

    def wait_saved(self, page=None):
        (page or self.page).wait_for_function("profile !== null && !transactionRunning")

    def task(self):
        raw = self.page.evaluate("(key) => localStorage.getItem(key)", KEY)
        self.assertIsNotNone(raw)
        return json.loads(raw)["execution"]["tasks"][0]

    def add(self):
        self.page.locator("#agendaName").fill("Fictional acceptance task")
        self.page.locator("#agendaDue").fill("2026-11-04")
        self.page.get_by_role("button", name="Add task", exact=True).click()
        self.page.wait_for_function(
            "profile?.execution?.tasks?.length === 1 && !transactionRunning"
        )
        self.assertEqual(self.task()["due"], "2026-11-04")

    def test_edit_draft_survives_reload_and_save_preserves_hold_and_date(self):
        self.add()
        self.page.locator('button[data-action="hold"]').click()
        self.page.wait_for_function(
            "profile.execution.tasks[0].agenda_hold === true && !transactionRunning"
        )
        self.page.locator('button[data-action="edit"]').click()
        self.page.locator("#editTaskName").fill("Fictional renamed task")
        self.assertEqual(self.task()["name"], "Fictional acceptance task",
                         "Draft edits must not silently modify the saved profile")
        self.page.reload()
        self.page.locator("#editTaskName").wait_for()
        self.assertEqual(
            self.page.locator("#editTaskName").input_value(), "Fictional renamed task"
        )
        self.page.get_by_role("button", name="Save changes", exact=True).click()
        self.page.wait_for_function(
            "profile.execution.tasks[0].name === 'Fictional renamed task' && !transactionRunning"
        )
        stored = self.task()
        self.assertEqual(stored["due"], "2026-11-04")
        self.assertTrue(stored["agenda_hold"])
        self.assertEqual(stored["name"], "Fictional renamed task")
        self.page.reload()
        self.assertEqual(self.task(), stored)

    def test_stale_edit_cannot_overwrite_other_tab_hold(self):
        self.add()
        self.page.locator('button[data-action="edit"]').click()
        self.page.locator("#editTaskName").fill("Should never overwrite newer HOLD")
        other = self.context.new_page()
        other.on("pageerror", lambda error: self.errors.append(str(error)))
        other.goto(self.url)
        other.locator('button[data-action="hold"]').click()
        other.wait_for_function(
            "profile.execution.tasks[0].agenda_hold === true && !transactionRunning"
        )
        held = json.loads(other.evaluate("(key) => localStorage.getItem(key)", KEY))
        self.page.get_by_role("button", name="Save changes", exact=True).click()
        self.page.wait_for_function("!transactionRunning")
        self.assertEqual(
            json.loads(self.page.evaluate("(key) => localStorage.getItem(key)", KEY)),
            held,
            "Stale editor must not overwrite a newer profile"
        )
        self.assertEqual(held["execution"]["tasks"][0]["name"],
                         "Fictional acceptance task")
        self.assertTrue(held["execution"]["tasks"][0]["agenda_hold"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
