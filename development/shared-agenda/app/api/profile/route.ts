import {env} from 'cloudflare:workers';
import {validProfile} from '../../../lib/profile-validator.js';
import {sharedProfile} from '../../../lib/shared-profile.mjs';
export const dynamic='force-dynamic';
const handler=(request:Request)=>sharedProfile(request,env.DB,validProfile);
export const GET=handler;
export const PUT=handler;
