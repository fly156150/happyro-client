import { renderGameSelect } from './GameSelect.js';

const mountNames = { peco: '大嘴鸟', dragon: '龙', gryphon: '狮鹫' };
const appearanceMounts = [null, '大嘴鸟', '大嘴鸟', '龙', '大嘴鸟', '大嘴鸟', '狮鹫'];

const names = ['默认外观', '骑士', '骑士领主', '符文骑士', '十字军', '圣殿十字军', '皇家禁卫军'];

export function renderCharacterAppearance(rows, pending) {
 const row = rows.find(entry => entry.appearances?.length > 1);
 if (!row) return '';
 const mountName = row.appearance === 0 ? mountNames[row.kind] : appearanceMounts[row.appearance];
 return `<section class="character-appearance"><h4>职业外观</h4>${renderGameSelect({
  name: 'character-appearance', ariaLabel: '职业外观', value: row.appearance,
  options: row.appearances.map(value => ({ value, label: names[value] })), disabled: pending
 })}${mountName ? `<p class="character-appearance-mount">骑乘外观：${mountName}</p>` : ''}</section>`;
}
