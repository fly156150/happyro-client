import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Exercise the actual shared renderer used by both learned and unlearned tree cells.
const source = readFileSync('src/UI/Components/SkillList/SkillListCommon.js', 'utf8');
const functions = ['_escapeHTML', '_skillTreeName'].map(name => {
 const start = source.indexOf(`function ${name}(`);
 return source.slice(start, source.indexOf('\n}', start) + 2);
}).join('\n');
const render = new Function('document', `${functions}; return _skillTreeName;`)(document);
function label(name) {
 const node = document.createElement('div');
 node.innerHTML = render(name);
 return node;
}

describe('skill tree names', () => {
 it('does not append an ellipsis to a short or exactly seven-character name', () => {
  expect(label('霸体').textContent).toBe('霸体');
  expect(label('单手剑使用熟练').textContent).toBe('单手剑使用熟练');
 });
 it('counts original characters before HTML escaping', () => {
  expect(label('<死亡骑士>能量').textContent).toBe('<死亡骑士>能...');
  expect(label('A&B').textContent).toBe('A&B');
  expect(label('<b>测试</b>').querySelector('b')).toBeNull();
 });
 it('keeps Unicode code points intact when shortening a long name', () => {
  expect(label('𠮷一二三四五六七').textContent).toBe('𠮷一二三四五六...');
 });
});
