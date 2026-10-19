import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
const source = readFileSync('src/Engine/MapEngine/Pet.js', 'utf8');
const start = source.indexOf('function onPetInformationUpdate(');
const end = source.indexOf('\n}', start) + 2;
function fixture(mobile) {
 const entity = () => ({ _job: 1002, life: { update: vi.fn() }, files: { body: { spr: 'poring.spr' } }, ACTION: { PERF1: 1, PERF2: 2, PERF3: 3, SPECIAL: 4, IDLE: 0 }, setAction: vi.fn() });
 const own = entity(), other = entity();
 const context = { Platform: { isMobile: mobile }, Session: { petId: 10, pet: { hungry: 60, friendly: 1000 } }, EntityManager: { get: id => id === 10 ? own : other }, PetInformations: { setIntimacy: vi.fn(), setHunger: vi.fn(), setAccessory: vi.fn() }, DB: { getPetEquipPath: () => 'backpack.act' }, Client: { loadFile: (_path, done) => done() }, updateGamePetState: vi.fn() };
 vm.createContext(context);vm.runInContext(source.slice(start, end), context);
 return { context, own, other, receive: context.onPetInformationUpdate };
}
it.each([false, true])('keeps foreign pet state out of the owner session (mobile=%s)', mobile => {
 const { context, other, receive } = fixture(mobile);
 receive({ type: 1, GID: 20, data: 12 });receive({ type: 2, GID: 20, data: 8 });receive({ type: 3, GID: 20, data: 10013 });
 expect(context.Session.pet).toEqual({ hungry: 60, friendly: 1000 });
 for (const update of Object.values(context.PetInformations)) expect(update).not.toHaveBeenCalled();
 expect(other.life.hp).toBe(8);expect(other.files.body.act).toBe('backpack.act');
});
it('continues updating the own desktop window and previous hunger', () => {
 const { context, receive } = fixture(false);
 receive({ type: 1, GID: 10, data: 800 });receive({ type: 2, GID: 10, data: 30 });receive({ type: 3, GID: 10, data: 10013 });
 expect(context.Session.pet).toEqual({ hungry: 30, oldHungry: 60, friendly: 800 });
 expect(context.PetInformations.setAccessory).toHaveBeenCalledWith(10013);
});
it('still renders other pets performances', () => {
 const { other, receive } = fixture(false);receive({ type: 4, GID: 20, data: 2 });
 expect(other.setAction).toHaveBeenCalledWith(expect.objectContaining({ action: 2 }));
});
it('accepts the self-only initialization packet', () => {
 const { context, receive } = fixture(false);receive({ type: 0, GID: 20, data: 0 });
 expect(context.Session.petId).toBe(20);
});
