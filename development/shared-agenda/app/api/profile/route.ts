import {env} from 'cloudflare:workers';
import '../../../lib/profile-validator.js';
import {sharedProfile} from '../../../lib/shared-profile.mjs';
export const dynamic='force-dynamic';
const handler=(request:Request)=>sharedProfile(request,env.DB,(globalThis as any).LifePilotStorage.validProfile);
export const GET=handler;
export const PUT=handler;
