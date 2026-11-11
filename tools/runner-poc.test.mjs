import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Synthetic-only, deterministic coding loop. This is NOT an AI coding agent.
// No repo writes, profile access, network calls, or credentials.
test('runner can make and verify an isolated code change', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lifepilot-runner-poc-'));
  try {
    const target = join(dir, 'today-label.mjs');
    await writeFile(target, 'export const todayLabel = () => "Todo";\n');
    let code = await readFile(target, 'utf8');
    assert.match(code, /Todo/);
    code = code.replace('"Todo"', '"Today"');
    await writeFile(target, code);
    assert.equal((await import('data:text/javascript,' + encodeURIComponent(code))).todayLabel(), 'Today');
    assert.equal(await readFile(target, 'utf8'), 'export const todayLabel = () => "Today";\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
