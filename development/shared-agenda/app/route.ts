import html from './legacy.html?raw';
import {env} from 'cloudflare:workers';
import {withGoogleClientId} from '../lib/page-config.mjs';
export const dynamic='force-dynamic';
export function GET(request:Request){
 const device=new URL(request.url).searchParams.get('qa-device');
 let content=html;
 if(device==='a'||device==='b')content=content.replaceAll('lifepilot-v02-profile','lifepilot-v02-profile:qa-'+device).replace('<head>','<head><meta name="lifepilot-sandbox" content="1">').replace('<body>','<body><p style="background:#ffe2a3;padding:12px;color:#172f37">QA sandbox · fictional data only · simulated device '+device.toUpperCase()+'</p>');
 content=withGoogleClientId(content,(env as Record<string,any>).GOOGLE_CLIENT_ID);
 return new Response(content,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
