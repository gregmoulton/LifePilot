# Life Pilot — OpenRouter isolated connector proof

This experiment is stacked on draft PR #77, not deployed or merged. It checks a synthetic-only `openrouter/free` connector. Source and fixture are fictional; no real user data, repo writes, live API calls, payments, or auto-generated code execution.

Local test: `node --test tools/runner-openrouter-connector.test.mjs`

Tests check deny-by-default, missing key, paid models/spend rejection, one fixed fictional request, 96-token output cap, zero retries, HTTP/rate-limit and timeout failures, and no returned secrets. Branch-only GitHub Actions runs mock tests with read-only permissions; it receives no API key.

Live provider connectivity is **not** yet verified. Before a live free-model probe, the owner must create a scoped private key at https://openrouter.ai/settings/keys , set an account/provider-side lifetime cap (suggested $1 for this experiment), verify auto top-up off at https://openrouter.ai/settings/credits , and use a separate approved manual test path. Never paste API keys in chat or GitHub source.

Do not merge or deploy. A response from a free AI model does not prove autonomous coding, PR creation, persistence, or safe tool use.
