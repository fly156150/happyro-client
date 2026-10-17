import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { pending, loader } = vi.hoisted(() => ({ pending: [], loader: { holdActs: false } }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: (path, cb, error) => {
 if (cb || error) pending.push({ path, cb, error });
 if (path.endsWith('.act') && cb && !loader.holdActs) cb({ sounds: [] });
 } } }));
vi.mock('DB/DBManager.js', () => ({ default: {
 getCartPath: i => `cart/${i}`, getBodyPath: job => `body/${job}`, isBaby: () => false, isMonster: () => false,
 getBodyPalPath: job => `palette/${job}`, getWeaponPath: (id, job) => `weapon/${job}/${id}`, getShieldPath: (id, job) => `shield/${job}/${id}`,
 getRobePath: (id, job) => `robe/${job}/${id}`, getWeaponSound: () => '', getWeaponTrail: () => null
} }));
vi.mock('Renderer/Entity/EntityAction.js', () => ({ default: vi.fn() }));
vi.mock('Renderer/GR2/GR2ModelRenderer.js', () => ({ default: {} }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
import Init from '../../src/Renderer/Entity/EntityView.js';
import Job from '../../src/DB/Jobs/JobConst.js';
function actor() {
 const e = { _job: Job.DRAGON_KNIGHT, _sex: 1, costume: Job.DRAGON_KNIGHT2, objecttype: 0,
  _head: -1, _headpalette: 0, _bodypalette: 3, _weapon: 1, _shield: 2, _robe: 3,
  _accessory: 0, _accessory2: 0, _accessory3: 0, sound: { preload: vi.fn() } };
 Init.call(e); e._body = 0; return e;
}
function finish(path) { const entry = pending.findLast(request => request.path === path); expect(entry).toBeTruthy(); entry.cb(); }
beforeEach(() => { pending.length = 0; loader.holdActs = false; });
afterEach(() => { vi.useRealTimers(); });
it('changes body and attachments without changing gameplay job or saved palette', () => {
 const e = actor(); e.ridingAppearance = 1;
 finish(`body/${Job.KNIGHT2}.spr`);
 expect(e._job).toBe(Job.DRAGON_KNIGHT); expect(e.job).toBe(Job.DRAGON_KNIGHT2); expect(e.renderJob).toBe(Job.KNIGHT2);
 finish(`weapon/${Job.KNIGHT2}/1.spr`);
 expect(e.files.weapon.spr).toBe(`weapon/${Job.KNIGHT2}/1.spr`);
 expect(e.files.body.pal).toBeNull(); expect(e.bodypalette).toBe(3);
});
it('rejects stale body and weapon loads after selecting another appearance', () => {
 const e = actor(); e.ridingAppearance = 1;
 const staleBody = pending.find(request => request.path === `body/${Job.KNIGHT2}.spr`); staleBody.cb();
 const staleWeapon = pending.find(request => request.path === `weapon/${Job.KNIGHT2}/1.spr`);
 e.ridingAppearance = 2; finish(`body/${Job.KNIGHT2_H}.spr`); finish(`weapon/${Job.KNIGHT2_H}/1.spr`);
 staleBody.cb(); staleWeapon.cb();
 expect(e.files.body.spr).toBe(`body/${Job.KNIGHT2_H}.spr`); expect(e.files.weapon.spr).toBe(`weapon/${Job.KNIGHT2_H}/1.spr`);
});
it('uses the selected walking body after dismount and restores the default on reset', () => {
 const e = actor(); e.ridingAppearance = 1; e.costume = 0; e.job = e._job;
 finish(`body/${Job.KNIGHT}.spr`);
 finish(`weapon/${Job.KNIGHT}/1.spr`);
 expect(e.ridingAppearance).toBe(1); expect(e.renderJob).toBe(Job.KNIGHT);
 expect(e.files.body.spr).toBe(`body/${Job.KNIGHT}.spr`);
 expect(e.files.weapon.spr).toBe(`weapon/${Job.KNIGHT}/1.spr`);
 e.ridingAppearance = 0;
 finish(`body/${Job.DRAGON_KNIGHT}.spr`);
 expect(e.renderJob).toBe(Job.DRAGON_KNIGHT);
 expect(e.files.body.spr).toBe(`body/${Job.DRAGON_KNIGHT}.spr`);
});
it('applies outfit priority before delayed body resources can race a selection', () => {
 vi.useFakeTimers();
 try {
  const e = actor(); e.ridingAppearance = 1;
  e.body = 1; e.ridingAppearance = 2;
  expect(e.renderJob).toBe(Job.DRAGON_KNIGHT2);
  vi.advanceTimersByTime(50);
  e.body = 0;
  vi.advanceTimersByTime(50);
  expect(e.renderJob).toBe(Job.KNIGHT2_H);
  finish(`body/${Job.KNIGHT2_H}.spr`);
  expect(e.files.body.spr).toBe(`body/${Job.KNIGHT2_H}.spr`);
 } finally { vi.useRealTimers(); }
});

it('keeps ordinary body and attachment loading on the original path', () => {
 vi.useFakeTimers();
 const e = actor(); e.job = e._job;
 expect(e._viewSeq).toBeUndefined();
 expect(e._appearanceLoadCancel).toBeUndefined();
 expect(vi.getTimerCount()).toBe(0);
 finish(`body/${Job.DRAGON_KNIGHT2}.spr`);
 expect(e._attachmentRequests).toBeUndefined();
 expect(pending.some(r => r.path.startsWith('robe/'))).toBe(false);
 expect(e.files.body.spr).toBe(`body/${Job.DRAGON_KNIGHT2}.spr`);
});
it.each(['spr', 'act'])('falls back locally when the appearance %s fails without changing saved choice', extension => {
 loader.holdActs = true;
 const e = actor(); e.ridingAppearance = 1;
 const failed = pending.find(r => r.path === `body/${Job.KNIGHT2}.${extension}`);
 failed.error();
 expect(e.ridingAppearance).toBe(1);
 expect(e.renderJob).toBe(Job.DRAGON_KNIGHT2);
 finish(`body/${Job.DRAGON_KNIGHT2}.spr`);
 expect(e.files.body.spr).toBe(`body/${Job.DRAGON_KNIGHT2}.spr`);
 finish(`body/${Job.KNIGHT2}.spr`);
 expect(e.files.body.spr).toBe(`body/${Job.DRAGON_KNIGHT2}.spr`);
 e.ridingAppearance = 0;
 expect(e._ridingAppearanceFailed).toBe(false);
});
it('requires both body resources and bounds a stalled appearance load', () => {
 vi.useFakeTimers(); loader.holdActs = true;
 const e = actor(); e.files.body.spr = 'original.spr'; e.ridingAppearance = 1;
 finish(`body/${Job.KNIGHT2}.spr`);
 expect(e.files.body.spr).toBe('original.spr');
 vi.advanceTimersByTime(8000);
 expect(e.renderJob).toBe(Job.DRAGON_KNIGHT2);
 expect(vi.getTimerCount()).toBe(0);
 finish(`body/${Job.DRAGON_KNIGHT2}.spr`);
 pending.find(r => r.path === `body/${Job.KNIGHT2}.act`).cb({ sounds: [] });
 expect(e.files.body.spr).toBe(`body/${Job.DRAGON_KNIGHT2}.spr`);
});
it('cancels a pending appearance and rejects its callbacks after choosing default', () => {
 vi.useFakeTimers();
 const e = actor(); e.ridingAppearance = 1;
 const old = pending.find(r => r.path === `body/${Job.KNIGHT2}.spr`);
 e.ridingAppearance = 0;
 finish(`body/${Job.DRAGON_KNIGHT2}.spr`);
 old.cb();
 expect(e.files.body.spr).toBe(`body/${Job.DRAGON_KNIGHT2}.spr`);
 expect(vi.getTimerCount()).toBe(0);
});
it('ignores an old default-body callback after selecting an appearance', () => {
 const e = actor(); e.job = e._job;
 const old = pending.find(r => r.path === `body/${Job.DRAGON_KNIGHT2}.spr`);
 e.ridingAppearance = 1; finish(`body/${Job.KNIGHT2}.spr`);
 old.cb();
 expect(e.files.body.spr).toBe(`body/${Job.KNIGHT2}.spr`);
});
