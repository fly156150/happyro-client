import {afterEach,expect,it,vi} from 'vitest';
import {loadAutoCombatSettings,saveAutoCombatSettings} from '../../src/UI/Game/AutoCombatSettings.js';
import {defaultRecoverySettings} from '../../src/UI/Game/RecoverySettings.js';
afterEach(()=>{localStorage.clear();vi.restoreAllMocks();});
const settings=()=>({species:[],skills:[],ranges:{search:20,activity:30},recovery:defaultRecoverySettings()});
it('round trips per-character recovery preferences and preserves explicit priority',()=>{
 const value=settings();value.recovery.hp.enabled=true;value.recovery.hp.items=[504,501];
 expect(saveAutoCombatSettings('character-a',value)).toBe(true);
 expect(loadAutoCombatSettings('character-a').recovery).toEqual(value.recovery);
 expect(loadAutoCombatSettings('character-b')).toBeUndefined();
});
it('rejects invalid or unbounded recovery preferences',()=>{
 const value=settings();value.recovery.hp.trigger=100;
 localStorage.setItem('character-a',JSON.stringify(value));expect(loadAutoCombatSettings('character-a')).toBeUndefined();
});
it('reports unavailable storage instead of pretending changes were saved',()=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
 expect(saveAutoCombatSettings('character-a',settings())).toBe(false);
});

it('uses the configured HP 50–80 and SP 20–50 default recovery intervals',()=>{
 expect(defaultRecoverySettings()).toEqual({hp:{enabled:false,trigger:50,target:80,items:[]},sp:{enabled:false,trigger:20,target:50,items:[]}});
});
