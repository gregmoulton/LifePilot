"""Build the isolated owner-test preview from the app source. Production files are not modified.
Usage: python3 preview/build.py <out_dir>
"""
import sys, os, re, shutil, subprocess

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
html = open(os.path.join(root, "index.html"), encoding="utf-8").read()
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
for s in scripts + []:
    shutil.copy(os.path.join(root, s), os.path.join(out, s))
shutil.copy(os.path.join(root, "preview", "dialog-shim.js"), os.path.join(out, "dialog-shim.js"))

try:
    commit = subprocess.check_output(["git", "-C", root, "rev-parse", "--short", "HEAD"], text=True).strip()
except Exception:
    commit = "unknown"

# The preview host supplies the document skeleton.
html = html.replace('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">', "", 1)
html = re.sub(r"<title>[^<]*</title>", "<title>Life Pilot Preview</title>", html, count=1)
html = html.replace("</head><body>", "", 1)
html = html.replace("</body></html>", "", 1)

style = """<style>
body{background:#f3f6f8;color:#17303b;color-scheme:light}
#previewBanner{background:#7a3b0c;color:#fff;padding:10px max(16px,calc((100vw - 1100px)/2));font:600 13px/1.4 system-ui,sans-serif}
#previewBanner b{letter-spacing:1px}
#previewDialog{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#102d3c;color:#fff;padding:16px max(16px,calc((100vw - 1100px)/2)) calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -4px 18px #0004;display:grid;gap:10px}
#previewDialog[hidden]{display:none}
#previewDialog p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
#previewDialog input{max-width:420px}
#previewDialog .pd-row{display:flex;gap:9px;flex-wrap:wrap}
#previewDialog button:focus-visible,#previewDialog input:focus-visible{outline:3px solid #e8c994;outline-offset:2px}
</style>"""
banner = ('<div id="previewBanner" role="note"><b>TEST PREVIEW</b> · Fictional data only. '
          'Separate from your live Life Pilot; nothing here reaches it. Build ' + commit + '.</div>')
html = html.replace("<header>", banner + "<header>", 1)
html = html.replace("</style>", "</style>" + style, 1)
html = html.replace("<script>", '<script src="dialog-shim.js"></script><script>', 1)
open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(html)
print("built", out, "files:", ["index.html", "dialog-shim.js"] + scripts)
