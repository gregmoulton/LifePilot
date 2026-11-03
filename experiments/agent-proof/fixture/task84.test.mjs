import test from 'node:test';
import assert from 'node:assert/strict';
import {agentStatus} from './task84.mjs';
test('scheduled agent makes fictional task Ready',()=>assert.equal(agentStatus(),'Ready'));
