// Run from repository root: node --test prime-workout/structure.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('workout inline script parses',()=>{assert.ok(script);new vm.Script(script)});
test('progress controls and data key exist',()=>{for(const marker of ['id="progress"','id="progress-exercise"','id="performance"',"prime-workout-mvp-v01"])assert.ok(html.includes(marker),marker)});
test('backup controls remain available',()=>{for(const marker of ['id="export"','id="import"','prime-workout-v01'])assert.ok(html.includes(marker),marker)});
test('existing history and editing controls remain available',()=>{for(const marker of ['id="history"','id="form"','id="cancel"','Edit','Delete'])assert.ok(html.includes(marker),marker)});
