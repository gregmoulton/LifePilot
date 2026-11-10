// The only entry point for the public /api/profile route. Identity comes exclusively from a verified
// Google ID token; there is no header-based path. Missing configuration fails closed (503).
// Config (public values, set by the owner on the host): GOOGLE_CLIENT_ID, OWNER_GOOGLE_SUBS (comma-separated `sub`s).
import {verifiedOwnerProfile} from './verified-owner.mjs';
import {createGoogleIdTokenVerifier} from './google-id-token.mjs';
import {validProfile} from './profile-validator.js';

export function createProfileHandler(env={},options={}){
 const handle=verifiedOwnerProfile({
  verifyIdToken:createGoogleIdTokenVerifier({clientId:env.GOOGLE_CLIENT_ID,...options}),
  ownerSubs:String(env.OWNER_GOOGLE_SUBS||'').split(',').map(s=>s.trim()).filter(Boolean),
 });
 return request=>handle(request,env.DB,validProfile);
}
