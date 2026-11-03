import test from 'node:test';
import assert from 'node:assert/strict';
import { todayLabel } from './label.mjs';
test('synthetic label updated from Todo to Today', () => assert.equal(todayLabel(), 'Today'));
