import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
test('bootable entry with mobile viewport and Three.js import map',()=>{assert.match(html,/name="viewport"/);assert.match(html,/type="importmap"/);assert.ok(script)});
test('gameplay script parses',()=>{assert.doesNotThrow(()=>new vm.Script(script.replace(/import \* as T from 'three';/,'') ))});
test('touch, combat, survival and end states exist',()=>{for(const token of ['pointerdown','function cast()','function endGame(','updateHUD()','renderer.render(scene,camera)'])assert.ok(script.includes(token),token)});
