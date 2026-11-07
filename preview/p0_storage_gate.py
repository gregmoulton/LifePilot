import sys, threading, http.server, functools, json
from playwright.sync_api import sync_playwright
d=sys.argv[1]; h=functools.partial(http.server.SimpleHTTPRequestHandler,directory=d); h.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),h); threading.Thread(target=srv.serve_forever,daemon=True).start()
url=f"http://localhost:{srv.server_port}/index.html"; res=[]
def check(n,c,x=""): res.append(c); print(("PASS " if c else "FAIL ")+n+("" if c else " — "+x))
KEY='lifepilot-v02-profile'
with sync_playwright() as p:
    b=p.chromium.launch()
    for label,bad in [("truncated JSON",'{"profile_name":"Fictional","goals":[{"id":"g1","name":"Fictional goal"'),("wrong shape",'{"goals":"oops"}')]:
        ctx=b.new_context(); pg=ctx.new_page(); pg.on("dialog",lambda dl:dl.accept("15"))
        pg.goto(url); pg.evaluate("([k,v])=>localStorage.setItem(k,v)",[KEY,bad]); pg.reload(); pg.wait_for_load_state("networkidle")
        body=pg.locator("body").inner_text()
        # Try every way a user could wipe it: Start Fresh, then a goal save.
        for name in ["Start Fresh","Start fresh"]:
            for btn in pg.get_by_role("button",name=name).all():
                try: btn.click(timeout=1500)
                except Exception: pass
        pg.wait_for_timeout(300)
        after=pg.evaluate("k=>localStorage.getItem(k)",KEY)
        check(f"[{label}] stored bytes unchanged after reload + Start Fresh", after==bad, repr(after)[:120])
        check(f"[{label}] app tells the user data could not be read", any(w in body.lower() for w in ["could not","cannot","recover","unreadable","damaged","not be read"]), body[:300])
        check(f"[{label}] recovery download offered", pg.locator("[onclick*=\"exportRecovery\"]").count()>0)
        ctx.close()
    # Failed import keeps data and backup
    ctx=b.new_context(); pg=ctx.new_page(); pg.on("dialog",lambda dl:dl.accept("15"))
    good={"profile_name":"Fictional","goals":[{"id":"g1","name":"Fictional goal"}],"decision_register":[{"id":"d1","decision":"Fictional decision"}]}
    pg.goto(url); pg.evaluate("([k,v])=>localStorage.setItem(k,v)",[KEY,json.dumps(good)]); pg.reload(); pg.wait_for_load_state("networkidle")
    before=pg.evaluate("()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))")
    for bad_import in ['{"goals":[]}','{"goals":[{"name":"no id"}],"decision_register":[{"id":"d"}]}','{"goals":[{"id":"g2"}],"decision_register":[]}','not json']:
        pg.evaluate("t=>importFile({text:async()=>t})",bad_import); pg.wait_for_timeout(250)
    pg.reload(); pg.wait_for_load_state("networkidle")
    after=pg.evaluate("()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage)))")
    check("4 invalid imports + reload leave all stored data and backups unchanged", before==after, after[:200])
    b.close()
srv.shutdown(); print(f"{sum(res)}/{len(res)} passed")
