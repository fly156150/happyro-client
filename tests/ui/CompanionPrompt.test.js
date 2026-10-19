import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ session: {}, actors: new Map(), prompts: [] }));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: id => s.actors.get(id) } }));
vi.mock('UI/UIManager.js', () => ({ default: { showPromptBox(message, yes, no, onYes, onNo) {
 const prompt = { message, onYes, onNo, remove: vi.fn() }; s.prompts.push(prompt); return prompt;
} } }));
import { confirmCompanionAction, invalidateCompanionPrompts, clearCompanionPrompts } from '../../src/UI/Game/CompanionPrompt.js';
beforeEach(() => {
 clearCompanionPrompts(); s.actors.clear(); s.prompts.length = 0;
 Object.assign(s.session, { Playing: true, AID: 10, Entity: { GID: 10, action: 0, ACTION: { DIE: 8 } }, petId: 20, homunId: 30, mercId: 40 });
 for (const id of [20, 30, 40]) s.actors.set(id, { GID: id, action: 0, ACTION: { DIE: 8 }, remove_tick: 0 });
});
it('executes one confirmation only once', () => {
 const action = vi.fn(); const prompt = confirmCompanionAction('pet', '喂食？', action);
 prompt.onYes(); prompt.onYes(); expect(action).toHaveBeenCalledOnce();
});
it.each(['pet', 'homunculus', 'mercenary'])('does not apply a stale %s confirmation to a replacement', kind => {
 const action = vi.fn(); const prompt = confirmCompanionAction(kind, '确认？', action);
 const key = { pet: 'petId', homunculus: 'homunId', mercenary: 'mercId' }[kind];
 const previous = s.session[key]; s.actors.delete(previous); s.session[key] = 99;
 s.actors.set(99, { GID: 99, action: 0, ACTION: { DIE: 8 }, remove_tick: 0 });
 prompt.onYes(); expect(action).not.toHaveBeenCalled();
});
it('rejects a recycled GID with a different entity object', () => {
 const action = vi.fn(); const prompt = confirmCompanionAction('pet', '确认？', action);
 s.actors.set(20, { GID: 20, action: 0, ACTION: { DIE: 8 }, remove_tick: 0 });
 prompt.onYes(); expect(action).not.toHaveBeenCalled();
});
it.each(['dead', 'disconnected', 'new-owner'])('rejects a confirmation when the owner is %s', change => {
 const action = vi.fn(); const prompt = confirmCompanionAction('pet', '确认？', action);
 if (change === 'dead') s.session.Entity.action = 8;
 if (change === 'disconnected') s.session.Playing = false;
 if (change === 'new-owner') s.session.Entity = { ...s.session.Entity };
 prompt.onYes(); expect(action).not.toHaveBeenCalled();
});
it('closes only the prompt belonging to the disappeared companion', () => {
 const pet = confirmCompanionAction('pet', '喂食？', vi.fn());
 const merc = confirmCompanionAction('mercenary', '解除？', vi.fn());
 invalidateCompanionPrompts(20); expect(pet.remove).toHaveBeenCalledOnce(); expect(merc.remove).not.toHaveBeenCalled();
});
it('closes every owned prompt on owner disappearance and rejects queued callbacks', () => {
 const actions = [vi.fn(), vi.fn()]; const p = confirmCompanionAction('pet', '喂食？', actions[0]); const h = confirmCompanionAction('homunculus', '删除？', actions[1]);
 invalidateCompanionPrompts(10); expect(p.remove).toHaveBeenCalledOnce(); expect(h.remove).toHaveBeenCalledOnce();
 p.onYes(); h.onYes(); expect(actions[0]).not.toHaveBeenCalled(); expect(actions[1]).not.toHaveBeenCalled();
});
it('replaces an older prompt and clears outstanding prompts on map or connection transitions', () => {
 const action = vi.fn(); const first = confirmCompanionAction('pet', '喂食？', action);
 const second = confirmCompanionAction('pet', '喂食？', action); expect(first.remove).toHaveBeenCalledOnce();
 first.onYes(); expect(action).not.toHaveBeenCalled(); clearCompanionPrompts(); expect(second.remove).toHaveBeenCalledOnce();
 second.onYes(); expect(action).not.toHaveBeenCalled();
});
it('does not show prompts for missing or dead actors', () => {
 s.actors.delete(20); expect(confirmCompanionAction('pet', '喂食？', vi.fn())).toBeNull();
 s.actors.get(30).action = 8; expect(confirmCompanionAction('homunculus', '喂食？', vi.fn())).toBeNull();
 expect(s.prompts).toHaveLength(0);
});
