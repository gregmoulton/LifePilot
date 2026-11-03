// Synthetic-only OpenRouter connector. Does not run model output or write repository files.
// This is NOT a persistent autonomous coding agent. It fails closed until explicitly enabled.
export const PROBE_MODEL = 'openrouter/free';
export const PROBE_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const EXPECTED_CODE = 'export const todayLabel = () => "Today";';
const SYNTHETIC_CODE = 'export const todayLabel = () => "Todo";';

export async function runSyntheticConnectorProbe({
  approved = false,
  apiKey,
  model = PROBE_MODEL,
  maxSpendUsd = 0,
  fetchImpl = globalThis.fetch,
  timeoutMs = 12000,
} = {}) {
  if (approved !== true) return {status: 'blocked', reason: 'explicit approval required'};
  if (maxSpendUsd !== 0 || model !== PROBE_MODEL)
    return {status: 'blocked', reason: 'non-free model or spending authorization'};
  if (typeof apiKey !== 'string' || !apiKey.trim())
    return {status: 'blocked', reason: 'missing API key'};
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000)
    return {status: 'blocked', reason: 'invalid runtime settings'};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Only fixed, fictional source is sent; no caller-provided prompts, repositories, or profile data.
    const response = await fetchImpl(PROBE_ENDPOINT, {
      method: 'POST',
      headers: {Authorization: \`Bearer \${apiKey}\`, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: PROBE_MODEL,
        messages: [
          {role: 'system', content: 'Return only one line of JavaScript, no Markdown. Never execute anything.'},
          {role: 'user', content: \`Change Todo to Today in this fictional snippet: \${SYNTHETIC_CODE}\`},
        ],
        max_completion_tokens: 96,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response?.ok) {
      return {status: 'api-error', httpStatus: Number(response?.status) || null};
    }
    const json = await response.json();
    const output = json?.choices?.[0]?.message?.content;
    if (typeof output !== 'string' || output.length > 2000)
      return {status: 'invalid-response'};
    // Never execute AI-generated text or auto-commit it.
    const exactMatch = output.trim() === EXPECTED_CODE;
    return {
      status: 'response-received',
      exactMatch,
      reportedModel: typeof json.model === 'string' ? json.model.slice(0, 128) : null,
      tokens: Number.isSafeInteger(json.usage?.total_tokens) ? json.usage.total_tokens : null,
    };
  } catch (err) {
    return {status: err?.name === 'AbortError' ? 'timeout' : 'transport-error'};
  } finally {
    clearTimeout(timer);
  }
}
