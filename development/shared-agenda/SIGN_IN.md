# Shared sync sign-in (draft — not enabled anywhere)

**Status:** this is an interim owner-only gate. It is **not** a claim of secure sync until the real Google OAuth client is registered, the HTTPS host behaviour is verified, and Android/Chromebook acceptance is done.

## How it works
1. `app/route.ts` puts the public `GOOGLE_CLIENT_ID` into the page as `<meta name="lifepilot-google-client-id">`, but only if the value is strictly formatted.
2. `public/google-sign-in.js` loads Google Identity Services only from `https://accounts.google.com/gsi/client`, and only when that meta tag is present. It receives an ID token and keeps it **in memory only**. The token is never put in localStorage, sessionStorage or cookies, and it is never logged. The token is sent only as `Authorization: Bearer …`. The adapter refuses, before any fetch, every URL that does not resolve to this page's origin with the path `/api/profile`. That covers absolute URLs, protocol-relative URLs, other paths, other schemes and user-info URLs. Redirects are refused (`redirect: 'error'`). Only one sign-in attempt runs at a time: concurrent callers share it and Google is prompted once. A Google callback that arrives when no attempt is waiting, for example after a timeout, is ignored and not stored.
3. `app/api/profile/route.ts` → `lib/profile-route.mjs` → `lib/verified-owner.mjs` → `lib/google-id-token.mjs`. The server verifies the token:
   - RS256 signature against Google's JWKS;
   - exact `aud`;
   - Google `iss`;
   - `exp` and `iat` (60 s skew);
   - non-empty `sub`.
   It then checks `sub` against the server-side `OWNER_GOOGLE_SUBS` and stores data under `google:<sub>`. Client-supplied `oai-authenticated-*` headers are stripped and never used.
4. If Google's signing keys cannot be fetched (with no usable cache), the API returns 503 rather than 401. The owner's sign-in is kept and storage is not touched.
5. If `GOOGLE_CLIENT_ID` or `OWNER_GOOGLE_SUBS` is missing, the API returns 503 before touching storage. The page shows "not set up" and local data is kept.

## Known limits (explicit; accepted only as an interim gate)
- **Replay window:** the bearer token is valid until its `exp`. Google issues ID tokens for about 1 hour. Anyone who obtains a copy of the token can call the API as the owner until then. Mitigations in place:
  - HTTPS only;
  - the token is kept in memory and never written to disk;
  - `Cache-Control: no-store` on API responses;
  - no CORS grant (the API sends no `Access-Control-Allow-*` headers);
  - a PUT must carry the same `Origin`;
  - the token is accepted only from the `Authorization` header, never from a query string or cookie;
  - tokens within 60 s of expiry are not used by the browser.
- **No nonce / no server session.** `checkNonce` exists in the verifier but is **not configured**, so replay protection beyond `exp` is **not present**. A server-issued, single-use nonce or a short server session is a later hardening gate.
- **Script integrity:** Google does not publish a versioned or SRI-pinnable GIS build. The script origin is fixed in code, but its contents are controlled by Google.
- **CSP:** this draft sets no Content-Security-Policy. The page still uses inline scripts and handlers, so a restrictive CSP needs its own change. Enabling sign-in on a host should add at least `script-src 'self' https://accounts.google.com/gsi/client`, `frame-src https://accounts.google.com/gsi/`, `connect-src 'self' https://accounts.google.com/gsi/`, and `style-src https://accounts.google.com/gsi/style`. Any live CSP change needs owner approval.
- **Existing shared rows** (keyed by the old platform identity) are **not migrated**. Recommended path: the owner exports a backup from the current version, checks it independently, signs in under the new version, and imports it explicitly. Old data is retained.

## Owner steps before this can be used (each needs separate approval)
1. Register a Google OAuth web client whose authorized JavaScript origin is the HTTPS host.
2. Set `GOOGLE_CLIENT_ID` and `OWNER_GOOGLE_SUBS` (the owner's Google `sub`) on the host.
3. Verify sign-in on the HTTPS host, then run Android and Chromebook acceptance.
