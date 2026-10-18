import Interface from '../../src/Preferences/Interface.js';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { showToast, clearToast } from '../../src/UI/Components/Toast.js';
beforeEach(() => { Interface.toastDuration = 2; });
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });
it('replaces feedback, escapes names and expires ordinary feedback after two seconds', () => {
	vi.useFakeTimers();
	document.body.innerHTML = '<div class="game-tools-window"><div class="tab-content"></div></div>';
	const root = document.querySelector('.game-tools-window');
	const container = root.firstElementChild;
	showToast(container, '已召唤 <波利>');
	expect(document.querySelector('[role=status]').textContent).toContain('<波利>');
	expect(document.querySelector('波利')).toBeNull();
	vi.advanceTimersByTime(1000);
	showToast(container, '正在提交...', 'info');
	expect(document.querySelectorAll('.ui-toast')).toHaveLength(1);
	vi.advanceTimersByTime(1000);
	expect(document.querySelector('.info')).not.toBeNull();
	vi.advanceTimersByTime(1000);
	expect(document.querySelector('.ui-toast')).toBeNull();
});
it('shows text-only feedback and dismisses it after two seconds', () => {
	vi.useFakeTimers();
	document.body.innerHTML = '<div class="game-tools-window"><div></div></div>';
	const container = document.querySelector('.game-tools-window div');
	showToast(container, '保存成功');
	expect(document.querySelector('.ui-toast').shadowRoot.querySelector('button, .icon')).toBeNull();
	vi.advanceTimersByTime(2000);
	expect(document.querySelector('.ui-toast')).toBeNull();

});

it('clears feedback when the window closes', () => {
	vi.useFakeTimers();
	document.body.innerHTML = '<div class="game-tools-window"><div></div></div>';
	const container = document.querySelector('.game-tools-window div');
	showToast(container, '已转职');
	clearToast(container);
	expect(document.querySelector('.ui-toast')).toBeNull();
	expect(vi.getTimerCount()).toBe(0);
});

it('replaces notifications across shadow-root panels without clearing another owner', () => {
 const first = document.createElement('div'), second = document.createElement('div');
 document.body.append(first, second);
 const owner = document.createElement('div'); first.attachShadow({mode:'open'}).append(owner);
 showToast(owner, '第一条'); showToast(second, '第二条', 'info');
 clearToast(owner);
 expect(document.querySelectorAll('.ui-toast')).toHaveLength(1);
 expect(document.querySelector('.ui-toast').textContent).toBe('第二条');
 clearToast(second);
});
it('clears notifications when the owning panel is removed or hidden', async () => {
 const owner = document.createElement('div'); document.body.append(owner);
 showToast(owner, '已保存'); owner.hidden = true;
 await Promise.resolve(); expect(document.querySelector('.ui-toast')).toBeNull();
 owner.hidden = false; showToast(owner, '已保存'); owner.remove();
 await Promise.resolve(); expect(document.querySelector('.ui-toast')).toBeNull();
 showToast(owner, '迟到的响应'); expect(document.querySelector('.ui-toast')).toBeNull();
});

it('uses the configured notification duration', () => {
 vi.useFakeTimers(); Interface.toastDuration = 4;
 const owner = document.createElement('div'); document.body.append(owner);
 showToast(owner, '已保存');
 vi.advanceTimersByTime(3999); expect(document.querySelector('.ui-toast')).not.toBeNull();
 vi.advanceTimersByTime(1); expect(document.querySelector('.ui-toast')).toBeNull();
});

it('ignores pending requests without replacing actual results or errors',()=>{
 const body=document.body.appendChild(document.createElement('div'));
 showToast(body,'等待服务器回复','pending');expect(document.querySelector('.ui-toast')).toBeNull();
 showToast(body,'容量不足','error');const error=document.querySelector('.ui-toast');
 showToast(body,'已提交，等待服务器回复','pending');expect(document.querySelector('.ui-toast')).toBe(error);
 showToast(body,'操作完成','success');expect(document.querySelector('.ui-toast').textContent).toBe('操作完成');
});

it('keeps desktop adventure feedback in its window and mobile feedback in the viewport', () => {
 const owner = document.createElement('section');
 owner.dataset.feedbackTheme = 'desktop';
 const container = owner.appendChild(document.createElement('div'));
 document.body.append(owner);
 showToast(container, '已发放');
 const desktop = owner.querySelector('.ui-toast');
 expect(desktop).not.toBeNull();
 clearToast(container);
 delete owner.dataset.feedbackTheme;
 showToast(container, '已发放');
 expect(owner.querySelector('.ui-toast')).toBeNull();
 clearToast(container);
});

it('enlarges touch-tablet feedback while preserving phone and desktop themes', () => {
 const owner=document.body.appendChild(document.createElement('div'));
 try {
  vi.stubGlobal('screen',{width:820,height:1180});
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));
  showToast(owner,'保存成功');
  expect(document.querySelector('.ui-toast').hasAttribute('data-tablet')).toBe(true);
  vi.stubGlobal('screen',{width:844,height:390});
  showToast(owner,'保存成功');
  expect(document.querySelector('.ui-toast').hasAttribute('data-tablet')).toBe(false);
  vi.stubGlobal('screen',{width:1180,height:820});
  owner.dataset.feedbackTheme='desktop';showToast(owner,'保存成功');
  expect(document.querySelector('.ui-toast').hasAttribute('data-tablet')).toBe(false);
 } finally {clearToast(owner);vi.unstubAllGlobals()}
});
