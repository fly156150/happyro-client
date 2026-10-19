import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const engine = readFileSync('src/Engine/MapEngine/Homun.js', 'utf8');
const request = engine.match(/HomunInformations\.reqNameEdit = function reqNameEdit\(value\) \{[\s\S]*?\n\};/)[0];
const ui = readFileSync('src/UI/Components/HomunInformations/HomunInformations.js', 'utf8');
const pending = ui.match(/HomunInformations\.setRenamePending = function setRenamePending\(pending\) \{[\s\S]*?\n\};/)[0];

test('live homunculus rename ignores duplicate clicks and unlocks only on authoritative state', () => {
 const controls = new Map(['.name', '.modify'].map(key => [key, {disabled:false,classList:{toggle(){}}}]));
 const hom = {renameAllowed:true,renamePending:false,getRoot:()=>({querySelector:key=>controls.get(key)})};
 const sent = [],entity = {life:{hp:100},remove_tick:0};
 const context = vm.createContext({HomunInformations:hom,Session:{Playing:true,homunId:5},EntityManager:{get:()=>entity},Network:{sendPacket:p=>sent.push(p)},PACKET:{CZ:{RENAME_MER:function(){}}},normalizeCompanionName:v=>v.trim()||null,showToast(){},document:{body:{}}});
 vm.runInContext(pending+'\n'+request,context);
 hom.reqNameEdit(' ');assert.equal(hom.renamePending,false);
 hom.reqNameEdit('Valid');hom.reqNameEdit('Duplicate');assert.equal(sent.length,1);assert.equal(controls.get('.modify').disabled,true);
 // The production property handler releases a rejected request and preserves one-time success.
 const ack = ui.match(/\tif \(info\.bModified !== undefined\) \{\n\t\tthis\.renameAllowed[\s\S]*?\n\t\}/)[0];
 context.info={bModified:4};vm.runInContext('(function(){'+ack+'}).call(HomunInformations)',context);
 assert.equal(hom.renamePending,false);assert.equal(controls.get('.modify').disabled,false);
 hom.reqNameEdit('Retry');assert.equal(sent.length,2);
 context.info={bModified:5};vm.runInContext('(function(){'+ack+'}).call(HomunInformations)',context);
 hom.reqNameEdit('Forbidden');assert.equal(sent.length,2);assert.equal(controls.get('.modify').disabled,true);
 hom.renameAllowed=true;entity.life.hp=0;hom.reqNameEdit('Dead');assert.equal(sent.length,2);
 entity.life.hp=100;entity.remove_tick=1;hom.reqNameEdit('Removed');assert.equal(sent.length,2);
});
