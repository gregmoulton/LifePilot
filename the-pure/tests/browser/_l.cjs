const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const {chromium}=require('playwright');
const root=path.resolve('dist'),out=process.argv[2];const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
const s=http.createServer((q,r)=>{let f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));if(f.endsWith(path.sep))f=path.join(f,'index.html');if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
(async()=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));const b=await chromium.launch();const c=await b.newContext({viewport:{width:384,height:832},isMobile:true,hasTouch:true,deviceScaleFactor:1.5});await c.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:'+s.address().port+'/#workout');await p.waitForTimeout(600);await p.screenshot({path:out+'/ready.png'});
await p.click('#start');await p.click('#hrGateProceed');await p.waitForTimeout(3600);await p.screenshot({path:out+'/active.png'});
console.log(await p.evaluate(()=>['stationName0','stationVariant0','stationPrevious0','stationState0'].map(id=>id+': '+document.getElementById(id).textContent).join('\n')));
console.log('errors',errs);await b.close();s.close()})();
