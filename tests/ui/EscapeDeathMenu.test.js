import { afterEach, expect, it, vi } from 'vitest';

vi.mock('UI/UIManager.js', () => ({ default: { addComponent: component => component } }));
vi.mock('UI/Components/AutoCombat/AutoCombat.js', () => ({ default: {} }));
vi.mock('UI/Components/SoundOption/SoundOption.js', () => ({ default: {} }));
vi.mock('UI/Components/GraphicsOption/GraphicsOption.js', () => ({ default: {} }));
vi.mock('UI/Components/ShortCutOption/ShortCutOption.js', () => ({ default: {} }));
vi.mock('Renderer/Renderer.js', () => ({ default: {} }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
import Escape from '../../src/UI/Components/Escape/Escape.js';
import GUIComponent from '../../src/UI/GUIComponent.js';

afterEach(() => {
	document.body.replaceChildren();
	Escape._host = null;
	Escape._shadow = null;
	Escape.manager = null;
});

it('raises a previously hidden death menu above an already open adventure window', () => {
	Escape._host = document.body.appendChild(document.createElement('div'));
	Escape._shadow = Escape._host.attachShadow({ mode: 'open' });
	Escape._shadow.innerHTML = Escape.render();
	Escape._host.style.zIndex = '50';
	Escape._host.style.display = 'none';
	Escape.__active = true;
	const tools = new GUIComponent('GameTools');
	tools._host = document.body.appendChild(document.createElement('div'));
	tools._host.style.zIndex = '51';
	tools.__active = true;
	Escape.manager = { components: { Escape, GameTools: tools } };
	Escape.showDeathMenu(false);
	expect(Escape._host.style.display).toBe('');
	expect(Number(Escape._host.style.zIndex)).toBeGreaterThan(Number(tools._host.style.zIndex));
	expect(Escape.getRoot().querySelector('.savepoint').style.display).toBe('');
	Escape.resetMenu();
	expect(Escape._host.style.display).toBe('none');
});
