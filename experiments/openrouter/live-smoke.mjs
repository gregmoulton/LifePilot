import {runSyntheticConnectorProbe} from '../../tools/runner-openrouter-connector.mjs';

// A single free-model request, with fixed fictional inputs. No code execution.
const result = await runSyntheticConnectorProbe({
  approved: process.env.LIFEPILOT_APPROVED_LIVE_FREE_TEST === 'yes',
  apiKey: process.env.OPENROUTER_API_KEY,
  timeoutMs: 28000,
});
console.log(JSON.stringify(result)); // No secrets, prompts or generated code are printed.
if (result.status !== 'response-received' || !result.exactMatch) process.exitCode = 1;
