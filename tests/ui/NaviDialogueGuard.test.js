import { expect, it, vi } from 'vitest';
import { createNaviDialogueGuard } from '../../src/UI/Game/NaviDialogueGuard.js';

it.each(['waiting', 'next', 'menu', 'text', 'number', 'close'])('never advances or closes a mobile %s dialogue', mode => {
	const respond = vi.fn(), close = vi.fn();
	const prepare = createNaviDialogueGuard({ interaction: () => ({ kind: 'npc', mode, respond, close }), desktopBusy: () => false });
	expect(prepare()).toMatchObject({ allowed: false });
	expect(respond).not.toHaveBeenCalled();
	expect(close).not.toHaveBeenCalled();
});
it('allows a new explicit attempt after normal dialogue completion, never schedules a teleport', () => {
	let interaction = { kind: 'deal' }, busy = false;
	const prepare = createNaviDialogueGuard({ interaction: () => interaction, desktopBusy: () => busy });
	expect(prepare().allowed).toBe(false);
	interaction = null;
	busy = true;
	expect(prepare().allowed).toBe(false);
	busy = false;
	expect(prepare()).toEqual({ allowed: true });
});
