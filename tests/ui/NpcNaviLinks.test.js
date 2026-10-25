vi.mock('UI/Game/NpcNaviPrompt.js', () => ({ showNpcNaviPrompt: service.open }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const service = vi.hoisted(() => ({ available: vi.fn(), open: vi.fn() }));
vi.mock('UI/Components/Navigation/NpcNaviService.js', () => ({
	isNpcNaviAvailable: service.available, openNpcNaviMap: service.open
}));
import { prepareNpcNaviLinks, handleNpcNaviClick } from '../../src/UI/Game/NpcNaviLinks.js';
beforeEach(() => { service.available.mockReset().mockReturnValue(true); service.open.mockReset(); });
afterEach(() => document.body.replaceChildren());
function setup() {
	const body = document.body.appendChild(document.createElement('section'));
	body.innerHTML = '<div class="text">请找<span class="navi-link" data-navi-info="first" data-navi-name="目标一"><span>目标一</span></span>。</div><input value="尚未提交"><footer><button>继续</button></footer>';
	const text = body.querySelector('.text');
	prepareNpcNaviLinks(text);
	text.addEventListener('click', handleNpcNaviClick);
	text.addEventListener('keydown', handleNpcNaviClick);
	return { body, text, link: text.querySelector('[data-navi-info]') };
}
it('keeps unapproved targets readable and noninteractive, including synthetic clicks', () => {
	service.available.mockReturnValue(false);
	const view = setup();
	expect(view.text.textContent).toBe('请找目标一。');
	expect(view.text.querySelector('.navi-link,[role=button],[tabindex]')).toBeNull();
	view.link.firstChild.click(); expect(service.open).not.toHaveBeenCalled();
});
it('delegates the selected target to the map service without submitting input', () => {
 const view=setup(), input=view.body.querySelector('input');view.text.scrollTop=66;input.value='保留输入';view.link.click();
 expect(service.open).toHaveBeenCalledWith('first',expect.objectContaining({label:'目标一'}));
 expect(view.body.querySelector('input')).toBe(input);expect(input.value).toBe('保留输入');expect(view.text.scrollTop).toBe(66);
});
it('opens from keyboard without allowing the Enter event to advance dialogue', () => {
	const view = setup(), next = vi.fn(); view.body.addEventListener('keydown', next);
	view.link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
	expect(service.open).toHaveBeenCalledOnce(); expect(next).not.toHaveBeenCalled();
});
it('checks the displayed label as well as INFO during rendering and again on click', () => {
	service.available.mockImplementation((info, label) => info === 'first' && label === '目标一');
	const view = setup();
	expect(service.available).toHaveBeenCalledWith('first', '目标一');
	expect(view.link.classList.contains('navi-link')).toBe(true);
	view.link.dataset.naviName = '同坐标不存在的NPC'; view.link.click();
	expect(service.open).not.toHaveBeenCalled();
	prepareNpcNaviLinks(view.text); expect(view.link.classList.contains('navi-link')).toBe(false);
});
