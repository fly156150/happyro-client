vi.mock('UI/Game/NpcNaviPrompt.js', () => ({ showNpcNaviPrompt: navi.open }));
import { afterEach, expect, it, vi } from 'vitest';
const navi = vi.hoisted(() => ({ available: vi.fn(() => true), open: vi.fn(() => true) }));
vi.mock('UI/Components/Navigation/NpcNaviService.js', () => ({ isNpcNaviAvailable: navi.available, openNpcNaviMap: navi.open }));
import { createNPCPanel, updateNPCCutin } from '../../src/UI/Mobile/game/NPCPanel.js';
afterEach(() => document.body.replaceChildren());
it('separates scrollable choices from actions and retains protocol option values', () => {
 const body=document.body.appendChild(document.createElement('div'));const respond=vi.fn();
 createNPCPanel(body,{mode:'menu',lines:['<b>你好</b>'],options:[{text:'选项一',value:3},{text:'选项二',value:7}],respond});
 expect(body.querySelector('.npc-lines').textContent).toBe('你好');expect(body.querySelector('b').textContent).toBe('你好');
 body.querySelectorAll('.npc-options button')[1].click();expect(respond).toHaveBeenCalledWith(7);
 expect(body.querySelector('.npc-actions').hidden).toBe(true);
 updateNPCCutin(body,{image:'npc.bmp'});expect(body.querySelector('.npc-content > img')).not.toBeNull();
 updateNPCCutin(body,{});expect(body.querySelector('img')).toBeNull();
});
it('omits the waiting indicator and retains inline input validation', () => {
 const body=document.body.appendChild(document.createElement('div'));
 createNPCPanel(body,{mode:'waiting'});expect(body.textContent).not.toContain('等待 NPC');expect(body.querySelector('.npc-actions').hidden).toBe(true);expect(document.querySelector('.ui-toast')).toBeNull();
 const respond=vi.fn(()=> '请输入有效的整数');createNPCPanel(body,{mode:'number',respond});
 const input=body.querySelector('input');input.value='abc';body.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));
 expect(respond).toHaveBeenCalledWith('abc');expect(input.getAttribute('aria-invalid')).toBe('true');expect(body.querySelector('.npc-error').hidden).toBe(false);
});

it('keeps buy/sell choice semantics and omits an empty action bar on result notices', () => {
 const body=document.body.appendChild(document.createElement('div'));const respond=vi.fn();
 createNPCPanel(body,{kind:'deal',respond});const buttons=body.querySelectorAll('.npc-actions button');
 buttons[0].click();buttons[1].click();expect(respond.mock.calls).toEqual([[0],[1]]);
 createNPCPanel(body,{kind:'notice',lines:['交易完成']});expect(body.querySelector('.npc-actions').hidden).toBe(true);expect(body.textContent).toContain('交易完成');
});

it('renders vending-machine emphasis and colors without allowing arbitrary HTML', () => {
 const body=document.body.appendChild(document.createElement('div'));
 body.style.backgroundColor='#191f26';
 createNPCPanel(body,{mode:'next',lines:['喝一杯<i>清爽</i>的<b>碳酸水</b>，^2ECCFA清理^000000肚子。<br>下一行','<img src=x onerror=alert(1)><b onclick="alert(1)">危险</b><script>alert(1)</script>']});
 expect(body.querySelector('i').textContent).toBe('清爽');
 expect(body.querySelector('b').textContent).toBe('碳酸水');
 expect(body.querySelector('br')).not.toBeNull();
 expect(body.querySelector('span').style.color).toBe('rgb(46, 204, 250)');
 expect(body.querySelector('img,script,[onclick]')).toBeNull();
});

it('supports shared paragraph, list, font and inline formats while stripping attributes',()=>{
 const body=document.body.appendChild(document.createElement('div'));
 createNPCPanel(body,{lines:['<p>段落 <u>下划线</u><s>删除</s><sub>下标</sub><sup>上标</sup></p><ul><li>列表</li></ul><font color="#ff8800" size="4" onclick="alert(1)">颜色</font><b onclick="alert(1)">粗体</b><iframe src="x"></iframe>']});
 expect(body.querySelector('p u').textContent).toBe('下划线');
 expect(body.querySelector('ul li').textContent).toBe('列表');
 expect(body.querySelector('font').getAttribute('color')).toBe('#ff8800');
 expect(body.querySelector('font').getAttribute('size')).toBe('4');
 expect(body.querySelector('b').textContent).toBe('粗体');
 expect(body.querySelector('[onclick],iframe')).toBeNull();
});

it('renders successful purchase entries as text with quantities',()=>{
 const body=document.body.appendChild(document.createElement('div'));
 createNPCPanel(body,{kind:'notice',resultItems:[{name:'<b>红色药水</b>',count:3},{name:'蓝色药水',count:2}]});
 expect(body.querySelectorAll('.npc-result-items li')).toHaveLength(2);
 expect(body.querySelector('.npc-result-items').textContent).toContain('× 3');
 expect(body.querySelector('b')).toBeNull();
});


it('hides only a matching opening NPC speaker without mutating the source lines', () => {
 const body=document.body.appendChild(document.createElement('div'));
 const lines=['[助理阿隆佐]','我是阿隆佐，欢迎。','[玩家]','你好。','[助理阿隆佐]','再见。'];
 createNPCPanel(body,{kind:'npc',title:'助理阿隆佐',lines});
 expect(body.querySelector('.npc-lines').textContent).toBe(lines.slice(1).join('\n'));
 expect(lines[0]).toBe('[助理阿隆佐]');
});
it('matches localized names and cosmetic formatting in the opening label', () => {
 const body=document.body.appendChild(document.createElement('div'));
 createNPCPanel(body,{kind:'npc',title:'助理阿隆佐',lines:['  ','<b>^FF0000[ Assistant   Alonzo#prt ]^000000</b>','<i>欢迎</i>']});
 expect(body.querySelector('.npc-lines').textContent).toBe('欢迎');
 expect(body.querySelector('i').textContent).toBe('欢迎');
});
it.each([
 ['卡普拉员工',['[卡普拉·莱拉]','欢迎。']],
 ['助理阿隆佐',['[玩家名字]','你好。']],
 ['助理阿隆佐',['[???]','你好。']],
 ['助理阿隆佐',['[警告]','请注意。']],
 ['助理阿隆佐',['[助理阿隆佐] 你好。']],
 ['助理阿隆佐',['这是旁白。','[助理阿隆佐]','你好。']],
 ['对话',['[对话]','你好。']],
 ['', ['[助理阿隆佐]','你好。']]
])('retains nonredundant or ambiguous dialogue for title %s', (title,lines) => {
 const body=document.body.appendChild(document.createElement('div'));
 createNPCPanel(body,{kind:'npc',title,lines});
 expect(body.querySelector('.npc-lines').textContent).toBe(lines.join('\n'));
});
it('rechecks each page and keeps non-NPC result headings', () => {
 const body=document.body.appendChild(document.createElement('div'));
 createNPCPanel(body,{kind:'npc',title:'助理阿隆佐',lines:['[助理阿隆佐]']});
 expect(body.querySelector('.npc-lines').hidden).toBe(true);
 createNPCPanel(body,{kind:'npc',title:'助理阿隆佐',lines:['[玩家]','你好。']});
 expect(body.querySelector('.npc-lines').textContent).toContain('[玩家]');
 createNPCPanel(body,{kind:'notice',title:'助理阿隆佐',lines:['[助理阿隆佐]']});
 expect(body.querySelector('.npc-lines').textContent).toBe('[助理阿隆佐]');
});

it('renders colored NAVI without attribute corruption and delegates nested text clicks', () => {
 const body = document.body.appendChild(document.createElement('div'));
 createNPCPanel(body, { kind: 'npc', id: 7, mode: 'next', lines: ['请找<NAVI>^4D4DFF[牧羊人]^000000<INFO>lasa_fild01,353,370,000,1,</INFO></NAVI>。'] });
 const link = body.querySelector('.navi-link');
 expect(link.dataset.naviName).toBe('[牧羊人]');
 expect(link.dataset.naviInfo).toBe('lasa_fild01,353,370,000,1,');
 expect(body.querySelector('.npc-lines').textContent).toBe('请找[牧羊人]。');
 link.querySelector('span').click();expect(navi.open).toHaveBeenCalledWith('lasa_fild01,353,370,000,1,',expect.objectContaining({label:'[牧羊人]'}));
 expect(body.querySelector('.npc-navi-teleport')).toBeNull();
});
