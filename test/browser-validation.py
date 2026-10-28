"""Fictional-data acceptance checks using native browser Web Locks and downloads.

Run: python3 -m pip install playwright
     python3 -m playwright install chromium
     python3 test/browser-validation.py
LIFEPILOT_BROWSER selects chromium (default), firefox or webkit.
CHROMIUM_PATH can select an installed Chromium. No external app/service is used.
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
KEY = 'lifepilot-v02-profile'


def fictional_profile():
    return {
        'schema_version': '0.2', 'product': 'Life Pilot',
        'profile_label': 'Fictional browser validation',
        'goals': [dict(id=f'g{i}', name=f'Fictional goal {i}', status='active',
                       known_context=[], next_actions=[], custom={'retain': i}) for i in range(8)],
        'decision_register': [],
        'system_improvement_log': [dict(id='log', summary='Fictional evidence', details='Retain me')],
        'unknown_top': {'unicode': 'Fictional café ✦', 'nested': [1, {'retain': True}]},
        'execution': {
            'programs': [dict(id='p', goal_id='g0', name='Fictional program')],
            'milestones': [dict(id='m', goal_id='g0', program_id='p', name='Fictional milestone')],
            'tasks': [dict(id='task', name='Fictional linked task', status='planned',
                           goal_id='g0', program_id='p', milestone_id='m',
                           due='2020-01-01', planned_minutes=10, custom='retain')],
            'observations': [], 'experiments': [], 'reviews': [],
        },
        'agenda': {'version': 1, 'events': [], 'proposals': [], 'rejections': []},
    }


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class BrowserValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://localhost:{cls.server.server_port}/'
        cls.playwright = sync_playwright().start()
        cls.engine = os.environ.get('LIFEPILOT_BROWSER', 'chromium')
        if cls.engine not in ('chromium', 'firefox', 'webkit'):
            raise ValueError('LIFEPILOT_BROWSER must be chromium, firefox or webkit')
        launch_options = {}
        if cls.engine == 'chromium':
            executable = os.environ.get('CHROMIUM_PATH')
            if executable:
                launch_options['executable_path'] = executable
            launch_options['args'] = ['--no-sandbox']
        cls.browser = getattr(cls.playwright, cls.engine).launch(**launch_options)
        print(f'{cls.engine} {cls.browser.version}; secure localhost; native locks; '
              f'timezone={os.environ.get("LIFEPILOT_TEST_TIMEZONE", "America/Phoenix")}', flush=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(
            accept_downloads=True,
            timezone_id=os.environ.get('LIFEPILOT_TEST_TIMEZONE', 'America/Phoenix'))
        self.errors = []
        self.context.on('page', lambda page: page.on('pageerror', lambda err: self.errors.append(str(err))))
        self.page = self.context.new_page()
        self.page.goto(self.url)
        self.temp = tempfile.TemporaryDirectory(prefix='lifepilot-fictional-')

    def tearDown(self):
        self.context.close()
        self.temp.cleanup()
        self.assertEqual(self.errors, [])

    def saved(self, page=None):
        return (page or self.page).evaluate('(key)=>localStorage.getItem(key)', KEY)

    def seed(self, value=None):
        raw = json.dumps(fictional_profile() if value is None else value, ensure_ascii=False)
        self.page.evaluate('([key,raw])=>localStorage.setItem(key,raw)', [KEY, raw])
        self.page.reload()
        return raw

    def wait_saved(self, page=None):
        (page or self.page).wait_for_function('!transactionRunning')

    def download(self, button, page=None):
        page = page or self.page
        with page.expect_download() as event:
            page.get_by_role('button', name=button, exact=True).click()
        download = event.value
        target = Path(self.temp.name) / download.suggested_filename
        download.save_as(target)
        self.assertIsNone(download.failure())
        self.assertGreater(target.stat().st_size, 0)
        return target

    def agenda(self, page=None):
        (page or self.page).get_by_role('button', name="Today's Agenda", exact=True).click()

    def test_native_lock_queue_stale_tab_download_and_reload(self):
        original = self.seed()
        a = self.page
        b = self.context.new_page(); b.goto(self.url)
        holder = self.context.new_page(); holder.goto(self.url)
        self.assertEqual(a.evaluate('({secure:isSecureContext, locks:typeof navigator.locks.request})'),
                         {'secure': True, 'locks': 'function'})
        holder.evaluate("""() => {
            window.lockHeld = false;
            window.heldLock = navigator.locks.request('life-pilot-storage:' + KEY, () => {
                window.lockHeld = true;
                return new Promise(resolve => window.releaseTestLock = resolve);
            });
        }""")
        holder.wait_for_function('window.lockHeld')
        for page, name in [(a, 'Fictional tab A'), (b, 'Fictional tab B')]:
            self.agenda(page)
            page.locator('#agendaName').fill(name)
            page.get_by_role('button', name='Add task', exact=True).click()
        holder.wait_for_function("""async () =>
            (await navigator.locks.query()).pending.filter(l => l.name === 'life-pilot-storage:' + KEY).length === 2""")
        self.assertEqual(self.saved(), original)
        holder.evaluate('window.releaseTestLock()')
        for page in [a, b]:
            page.evaluate("Promise.race([transactionQueue,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Cross-tab transaction did not settle within 15 seconds')),15000))])")
            self.wait_saved(page)
        outcomes = [page.evaluate("""() => ({
            warning: document.getElementById('storageMessage').textContent,
            unsaved: unsavedProfile !== null,
            taskNames: profile.execution.tasks.map(t=>t.name)
        })""") for page in [a, b]]
        self.assertEqual(sum(o['unsaved'] for o in outcomes), 1,
                         'Exactly one stale writer must retain unsaved data: ' + json.dumps(outcomes))
        winner, loser = (a, b) if a.locator('#storageWarning').is_hidden() else (b, a)
        saved = json.loads(self.saved())
        self.assertEqual(len(saved['execution']['tasks']), 2)
        self.assertIn('Another tab changed', loser.locator('#storageMessage').inner_text())
        attempted = json.loads(self.download('Download unsaved changes', loser).read_text())
        self.assertEqual(len(attempted['execution']['tasks']), 2)
        self.assertNotEqual(attempted['execution']['tasks'][-1]['name'], saved['execution']['tasks'][-1]['name'])
        self.assertNotIn('Task saved', loser.locator('#toast').inner_text())
        loser.reload(); self.agenda(loser)
        loser.locator('#agendaName').fill(attempted['execution']['tasks'][-1]['name'])
        loser.get_by_role('button', name='Add task', exact=True).click(); self.wait_saved(loser)
        self.assertEqual(len(json.loads(self.saved())['execution']['tasks']), 3)

    def test_actual_export_import_and_file_restore_preserve_every_field(self):
        expected = fictional_profile(); self.seed(expected)
        self.agenda()
        self.page.get_by_role('button',name='Refresh proposals',exact=True).click(); self.wait_saved()
        self.page.locator('[data-action=reject]').click(); self.wait_saved()
        self.page.once('dialog',lambda d:d.accept('7'))
        self.page.locator('[data-action=complete][data-id=task]').click(); self.wait_saved()
        expected = json.loads(self.saved())
        self.assertEqual(len(expected['agenda']['rejections']),1)
        self.assertEqual(expected['agenda']['proposals'][0]['status'],'rejected')
        self.assertGreaterEqual(len(expected['agenda']['events']),3)
        self.assertEqual(expected['execution']['tasks'][0]['actual_minutes'],7)
        exported = self.download('Export Backup')
        self.assertEqual(json.loads(exported.read_text()), expected)
        self.page.evaluate('localStorage.clear()'); self.page.reload()
        self.page.locator('#welcomeFile').set_input_files(str(exported))
        self.page.wait_for_function('profile!==null && !transactionRunning')
        self.assertEqual(json.loads(self.saved()), expected)
        self.page.reload()
        self.assertEqual(self.page.evaluate('profile'), expected)
        # Corrupt only this disposable context, then use the real file input.
        broken = 'FICTIONAL { corrupt bytes ✦\n'
        self.page.evaluate('([key,raw])=>localStorage.setItem(key,raw)', [KEY, broken]); self.page.reload()
        self.page.once('dialog', lambda d: d.accept())
        self.page.locator('#storageWarning input[type=file]').set_input_files(str(exported))
        self.page.wait_for_function("document.getElementById('toast').textContent==='Backup restored successfully'")
        self.assertEqual(json.loads(self.saved()), expected)
        self.assertEqual(self.download('Download pre-recovery data').read_text(), broken)
        self.page.reload()
        self.assertEqual(self.page.evaluate('profile'), expected)

    def test_previous_backup_reset_restore_and_cancel(self):
        original = self.seed()
        self.page.once('dialog', lambda d: d.accept())
        self.page.get_by_role('button', name='Switch / Reset', exact=True).click(); self.wait_saved()
        self.assertIsNone(self.saved())
        self.page.once('dialog', lambda d: d.dismiss())
        self.page.get_by_role('button', name='Restore previous backup', exact=True).last.click()
        self.page.evaluate('transactionQueue'); self.assertIsNone(self.saved())
        self.page.once('dialog', lambda d: d.accept())
        self.page.get_by_role('button', name='Restore previous backup', exact=True).last.click()
        self.page.evaluate('transactionQueue')
        self.assertEqual(json.loads(self.saved()), json.loads(original))
        self.assertEqual(self.download('Download previous backup').read_text(), original)

    def test_invalid_import_and_cancelled_file_restore_preserve_bytes(self):
        original = self.seed()
        self.page.get_by_role('button', name='Profile & Import', exact=True).click()
        self.page.once('dialog', lambda d: d.accept())
        self.page.locator('#app input[type=file]').set_input_files(
            {'name':'fictional-invalid.json', 'mimeType':'application/json', 'buffer':b'{"goals":[],"execution":{"tasks":{}}}'})
        self.wait_saved()
        self.assertEqual(self.saved(), original)
        self.page.reload()
        self.page.evaluate("storageWarning('Fictional recovery test')")
        self.page.once('dialog', lambda d: d.dismiss())
        self.page.locator('#storageWarning input[type=file]').set_input_files(
            {'name':'fictional-valid.json','mimeType':'application/json','buffer':json.dumps(fictional_profile()).encode()})
        self.page.evaluate('transactionQueue')
        self.assertEqual(self.saved(), original)

    def test_failed_write_rolls_back_and_downloads_attempt(self):
        original = self.seed(); self.agenda()
        # Explicit storage fault injection; navigator.locks stays native.
        self.page.evaluate("""() => {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key,value) {
            if(key===KEY) throw new DOMException('Fictional quota failure','QuotaExceededError');
            return original.call(this,key,value);
          };
        }""")
        self.page.locator('#agendaName').fill('Fictional failed task')
        self.page.get_by_role('button', name='Add task', exact=True).click(); self.wait_saved()
        self.assertEqual(self.saved(), original)
        self.assertEqual(self.page.evaluate('profile.execution.tasks.length'), 1)
        self.assertNotIn('Task saved', self.page.locator('#toast').inner_text())
        attempt = json.loads(self.download('Download unsaved changes').read_text())
        self.assertEqual(attempt['execution']['tasks'][-1]['name'], 'Fictional failed task')
        self.page.reload(); self.assertEqual(json.loads(self.saved()), json.loads(original))

    def test_native_lock_released_when_holder_tab_closes(self):
        self.seed()
        holder = self.context.new_page(); holder.goto(self.url)
        holder.evaluate("""() => {
          window.lockHeld=false;
          navigator.locks.request('life-pilot-storage:'+KEY,()=>{
            window.lockHeld=true;return new Promise(()=>{});
          });
        }""")
        holder.wait_for_function('window.lockHeld')
        self.agenda(); self.page.locator('#agendaName').fill('Fictional after tab close')
        self.page.get_by_role('button', name='Add task', exact=True).click()
        self.page.wait_for_function('transactionRunning')
        holder.close(); self.wait_saved()
        self.assertEqual(len(json.loads(self.saved())['execution']['tasks']), 2)

    def test_stale_restore_cannot_replace_other_tab_save(self):
        self.seed()
        b=self.context.new_page(); b.goto(self.url)
        self.agenda(); self.page.locator('#agendaName').fill('Fictional winning task')
        self.page.get_by_role('button', name='Add task', exact=True).click(); self.wait_saved()
        winning = self.saved()
        b.evaluate("storageWarning('Fictional stale recovery test')")
        b.once('dialog',lambda d:d.accept())
        b.locator('#storageWarning input[type=file]').set_input_files(
            {'name':'fictional.json','mimeType':'application/json','buffer':json.dumps(fictional_profile()).encode()})
        b.evaluate('transactionQueue')
        self.assertEqual(self.saved(), winning)
        self.assertIn('Another tab changed',b.locator('#storageMessage').inner_text())

    def test_existing_recovery_copy_is_never_overwritten(self):
        raw = json.dumps(fictional_profile())
        self.page.evaluate("""([key,raw]) => {
          localStorage.setItem(key,'FICTIONAL corrupt current');
          localStorage.setItem(key+':last-good',raw);
          localStorage.setItem(key+':recovery-original','FICTIONAL earlier recovery');
        }""", [KEY,raw])
        self.page.reload()
        self.page.get_by_role('button',name='Start Fresh',exact=True).click(); self.wait_saved()
        self.assertEqual(self.saved(),'FICTIONAL corrupt current')
        self.page.once('dialog',lambda d:d.accept())
        self.page.get_by_role('button',name='Restore previous backup',exact=True).first.click()
        self.page.evaluate('transactionQueue')
        self.assertIn('earlier recovery copy',self.page.locator('#storageMessage').inner_text())
        self.assertEqual(self.saved(),'FICTIONAL corrupt current')
        self.assertEqual(self.download('Download pre-recovery data').read_text(),'FICTIONAL earlier recovery')
        self.assertEqual(self.download('Download stored data').read_text(),'FICTIONAL corrupt current')

    def test_execution_result_cannot_bypass_agenda_hold(self):
        self.seed(); self.agenda()
        self.page.locator('[data-action=hold][data-id=task]').click(); self.wait_saved()
        saved = self.saved()
        self.page.get_by_role('button', name='Execution', exact=True).click()
        answers=iter(['completed','7'])
        self.page.on('dialog',lambda d:d.accept(next(answers)) if d.type=='prompt' else d.accept())
        self.page.get_by_role('button',name='Record result',exact=True).click(); self.wait_saved()
        self.assertEqual(self.saved(),saved)
        self.agenda(); self.page.locator('[data-action=release][data-id=task]').click(); self.wait_saved()
        self.page.evaluate("completeTask('task','completed',7)")
        self.assertEqual(json.loads(self.saved())['execution']['tasks'][0]['actual_minutes'],7)

    def test_old_schedule_review_cannot_reopen_agenda_completion(self):
        self.seed()
        self.page.evaluate("proposeReview('g0','Fictional schedule conflict','schedule')")
        self.agenda()
        self.page.once('dialog',lambda d:d.accept('7'))
        self.page.locator('[data-action=complete][data-id=task]').click(); self.wait_saved()
        completed = self.saved()
        self.page.get_by_role('button',name='Motivation Lab',exact=True).click()
        review_id=self.page.evaluate('records().reviews[0].id')
        for field,value in [('start','2026-10-24'),('end','2026-10-30'),('due','2026-10-26T10:00')]:
            self.page.locator(f'[id="{field}-{review_id}"]').fill(value)
        self.page.once('dialog',lambda d:d.accept())
        self.page.get_by_role('button',name='Approve experiment',exact=True).click(); self.wait_saved()
        self.assertEqual(self.saved(),completed)
        self.page.reload()
        task=json.loads(self.saved())['execution']['tasks'][0]
        self.assertEqual((task['status'],task['actual_minutes']),('completed',7))


    def test_today_priority_and_enter_save_without_changing_legacy_profile(self):
        expected=fictional_profile(); expected['execution']['tasks']=[]
        self.seed(expected); self.agenda()
        self.assertTrue(self.page.get_by_role('radio',name='Normal',exact=True).is_checked())
        before=self.saved()
        self.page.locator('#agendaName').fill('Fictional form only')
        self.page.locator('#agendaDue').fill('2028-01-01')
        self.page.get_by_role('button',name='Today',exact=True).click()
        today=self.page.evaluate("[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-')")
        self.assertEqual(self.page.locator('#agendaDue').input_value(),today)
        self.assertEqual(self.saved(),before)  # Today does not submit the form.
        for count,(name,level) in enumerate([('Fictional low','Low'),('Fictional high','High'),('Fictional normal','Normal')],1):
            self.page.locator('#agendaName').fill(name)
            self.page.get_by_role('button',name='Today',exact=True).click()
            self.page.get_by_role('radio',name=level,exact=True).check()
            self.page.locator('#agendaName').press('Enter')
            self.page.wait_for_function('(count)=>profile.execution.tasks.length===count && !transactionRunning',arg=count)
        saved=json.loads(self.saved())
        self.assertEqual(saved['goals'],expected['goals'])
        self.assertEqual(saved['unknown_top'],expected['unknown_top'])
        self.assertTrue(all(t['due']==today for t in saved['execution']['tasks']))
        self.page.reload()
        self.assertEqual(json.loads(self.saved()),saved)
        self.assertEqual(self.page.locator('#agendaWorkspace article b').all_text_contents(),['Fictional high','Fictional normal','Fictional low'])
        self.assertEqual([t['agenda_importance'] for t in saved['execution']['tasks']],['low','high','normal'])

    def test_quick_capture_controls_fit_narrow_viewport(self):
        self.page.set_viewport_size({'width':360,'height':800})
        self.seed(); self.agenda()
        self.assertTrue(self.page.get_by_role('button',name='Today',exact=True).is_visible())
        self.assertEqual(self.page.get_by_role('radio').count(),3)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.assertEqual(self.page.locator('#agendaDue').input_value(),'')


    def test_recommendation_later_reload_refresh_and_review_again(self):
        self.seed(); self.agenda()
        before = json.loads(self.saved())['execution']
        self.page.get_by_role('button',name='Refresh proposals',exact=True).click()
        self.page.get_by_role('button',name='Later',exact=True).click()
        self.page.wait_for_function("!transactionRunning && profile.agenda.proposals[0].status==='deferred'")
        self.page.reload(); self.agenda()
        self.page.get_by_role('button',name='Refresh proposals',exact=True).click()
        self.page.wait_for_function("!transactionRunning && profile.agenda.proposals[0].status==='deferred'")
        self.assertEqual(self.page.get_by_role('button',name='Later',exact=True).count(),0)
        self.assertTrue(self.page.get_by_role('heading',name='Recommendations for later',exact=True).is_visible())
        saved = json.loads(self.saved())
        self.assertEqual(saved['execution'],before)
        self.assertEqual(saved['agenda']['proposals'][0]['status'],'deferred')
        self.assertEqual(saved['agenda']['rejections'],[])
        self.page.get_by_role('button',name='Review again',exact=True).click()
        self.page.wait_for_function("!transactionRunning && profile.agenda.proposals[0].status==='proposed'")
        self.page.reload(); self.agenda()
        self.assertEqual(self.page.get_by_role('button',name='Later',exact=True).count(),1)
        self.assertEqual(json.loads(self.saved())['execution'],before)
        self.assertEqual(json.loads(self.saved())['agenda']['proposals'][0]['status'],'proposed')


    def test_batch_review_cancel_edit_and_atomic_save_survive_reload(self):
        self.page.set_viewport_size({'width':360,'height':800})
        self.seed(); self.agenda()
        before = self.saved()
        self.page.get_by_role('button',name='Today',exact=True).click()
        self.page.get_by_role('radio',name='High',exact=True).check()
        self.page.get_by_text('Add several tasks',exact=True).click()
        self.page.locator('#agendaBatchText').fill('Fictional errand\nFictional pickup\nFictional online task')
        self.page.get_by_role('button',name='Review tasks',exact=True).click()
        self.assertEqual(self.saved(),before)
        self.page.get_by_role('button',name='Cancel',exact=True).click()
        self.assertEqual(self.saved(),before)
        self.page.get_by_role('button',name='Review tasks',exact=True).click()
        self.page.locator('#batchName0').fill('Fictional <img src=x onerror=alert(1)>')
        self.page.locator('#batchDue1').fill('2030-01-01')
        self.page.locator('#batchPriority1').select_option('normal')
        self.page.locator('#batchDue2').fill('')
        self.page.locator('#batchPriority2').select_option('low')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.page.get_by_role('button',name='Add 3 tasks',exact=True).click()
        self.page.wait_for_function('profile.execution.tasks.length===4 && !transactionRunning')
        self.page.reload(); self.agenda()
        saved=json.loads(self.saved())
        self.assertEqual(len(saved['execution']['tasks']),4)
        self.assertEqual(saved['execution']['tasks'][2]['due'],'2030-01-01')
        self.assertEqual(saved['execution']['tasks'][3]['agenda_importance'],'low')
        self.assertEqual(saved['execution']['tasks'][3]['due'],'')
        self.assertEqual(len(saved['goals']),8)
        self.assertEqual(self.page.locator('#agendaWorkspace img').count(),0)
        self.assertTrue(self.page.get_by_text('Fictional <img src=x onerror=alert(1)>',exact=True).is_visible())


if __name__ == '__main__':
    unittest.main(verbosity=2)

