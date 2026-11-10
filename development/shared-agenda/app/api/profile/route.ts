import {env} from 'cloudflare:workers';
import {createProfileHandler} from '../../../lib/profile-route.mjs';
export const dynamic='force-dynamic';
// Verified Google ID token only; never client-supplied identity headers. Unconfigured => 503.
let handler:((request:Request)=>Promise<Response>)|undefined;
const handle=(request:Request)=>(handler??=createProfileHandler(env as Record<string,any>))(request);
export const GET=handle;
export const PUT=handle;
