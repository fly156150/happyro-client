import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({ loadCurrentCharacter: vi.fn(), maintainCurrentCharacter: vi.fn() }));
import { loadCurrentCharacter, maintainCurrentCharacter } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import { renderCharacterAppearance } from '../../src/UI/Components/GameTools/CharacterAppearance.js';
import tab from '../../src/UI/Components/GameTools/CharacterMaintenanceTab.js';

const defaults = { id: 0, name: '默认外观', mountLabel: '', fallbackOnMount: false };
const appearance = { current: 42, options: [defaults, { id: 42, name: '服务端职业名称', mountLabel: '', fallbackOnMount: false }], reason: '' };
const snapshot = { job_id: 4255, characterAppearance: appearance, riding: [], jobs: [{ id: 4255 }], traits: { enabled: false },
 str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
afterEach(() => { document.body.replaceChildren(); vi.resetAllMocks(); });
function render(value = appearance, pending = false) {
 document.body.innerHTML = renderCharacterAppearance(value, pending);
 return document.querySelector('.character-appearance');
}
it('renders server allowed options without any riding data or fixed ID range', () => {
 const root = render();
 expect(root.querySelector('.game-select-value').value).toBe('42');
 expect(root.querySelector('.game-select-trigger').textContent).toBe('服务端职业名称');
 expect(root.querySelector('.game-select-trigger').disabled).toBe(false);
 expect(root.querySelectorAll('[role=option]')).toHaveLength(2);
 expect(root.querySelector('.character-appearance-mount')).toBeNull();
});
it('omits appearance captions and keeps fallback selection visible', () => {
 render({ ...appearance, options: [defaults, { ...appearance.options[1], mountLabel: '战狼', fallbackOnMount: false }] });
 expect(document.querySelector('.character-appearance-mount')).toBeNull();
 expect(document.querySelector('.character-appearance h4')).toBeNull();
 expect(document.querySelector('.character-appearance-hint')).toBeNull();
 render({ ...appearance, options: [defaults, { ...appearance.options[1], fallbackOnMount: true }] });
 expect(document.querySelector('.character-appearance-hint')).toBeNull();
 expect(document.querySelector('.game-select-value').value).toBe('42');
});
it('escapes server names and unknown reason text without rendering mount labels', () => {
 const attack = '<img src=x onerror=alert(1)>';
 const root = render({ ...appearance, reason: attack, options: [defaults, { ...appearance.options[1], name: attack, mountLabel: attack }] });
 expect(root.querySelector('img')).toBeNull();
 expect(root.querySelector('.game-select-trigger').textContent).toBe(attack);
 expect(root.querySelector('.character-appearance-mount')).toBeNull();
 expect(root.querySelector('.character-appearance-reason').textContent).toBe(attack);
});
it.each(['appearance_busy', 'appearance_job_required'])('disables blocked appearance with a readable reason: %s', reason => {
 const root = render({ ...appearance, reason });
 expect(root.querySelector('.game-select-trigger').disabled).toBe(true);
 expect(root.querySelector('.character-appearance-reason').textContent).not.toContain('appearance_');
});
it('hides unnecessary default-only selector and disables pending selections', () => {
 expect(renderCharacterAppearance({ current: 0, options: [defaults], reason: '' }, false)).toBe('');
 expect(render(appearance, true).querySelector('.game-select-trigger').disabled).toBe(true);
});
it.each([false, true])('submits independent selection and uses full refreshed snapshot on mobile=%s', async mobile => {
 loadCurrentCharacter.mockResolvedValue(snapshot);
 maintainCurrentCharacter.mockResolvedValue({ ...snapshot, characterAppearance: { ...appearance, current: 0 } });
 document.body.innerHTML = '<div class="game-tools-window"></div>';
 const root = document.body.firstElementChild;
 const dispose = tab.mount(root, { mobile });
 await vi.waitFor(() => expect(root.querySelector('.character-appearance')).not.toBeNull());
 root.querySelector('.character-appearance [data-value="0"]').click();
 await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenCalledWith('character.appearance.update', { appearance: 0 }));
 await vi.waitFor(() => expect(root.querySelector('[name="character-appearance"]').value).toBe('0'));
 expect(root.querySelectorAll('[data-riding-kind]')).toHaveLength(0);
 dispose();
});
it('reloads after rejected selection so changed server eligibility replaces stale options', async () => {
 loadCurrentCharacter.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, characterAppearance: { current: 0, options: [defaults], reason: '' } });
 maintainCurrentCharacter.mockRejectedValue(new Error('当前职业无法使用此外观'));
 document.body.innerHTML = '<div class="game-tools-window"></div>';
 const root = document.body.firstElementChild;
 const dispose = tab.mount(root);
 await vi.waitFor(() => expect(root.querySelector('.character-appearance')).not.toBeNull());
 root.querySelector('.character-appearance [data-value="0"]').click();
 await vi.waitFor(() => expect(loadCurrentCharacter).toHaveBeenCalledTimes(2));
 await vi.waitFor(() => expect(root.querySelector('.character-appearance')).toBeNull());
 expect(document.querySelector('.ui-toast.error').textContent).toBe('当前职业无法使用此外观');
 dispose();
});
