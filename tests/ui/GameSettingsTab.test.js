import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
 loadAdventureGameSettings: vi.fn(), applyAdventureGameSettings: vi.fn()
}));
vi.mock('../../src/UI/Components/Confirmation.js', () => ({requestConfirmation: vi.fn().mockResolvedValue(true)}));
import { loadAdventureGameSettings, applyAdventureGameSettings } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import { requestConfirmation } from '../../src/UI/Components/Confirmation.js';
import GameSettingsTab from '../../src/UI/Components/GameTools/GameSettingsTab.js';

beforeEach(() => {vi.clearAllMocks();requestConfirmation.mockResolvedValue(true);});
function fixture(guaranteed = 0) {
 const keys = ['base_exp_rate', 'job_exp_rate', 'refine_chance_rate', 'refine_always_success',
  'navigation_teleport_policy', 'navigation_teleport_cross_map', 'navigation_teleport_cooldown',
  'navigation_map_channels_enabled', 'game_tools_monster_spawn_policy', 'game_tools_monster_spawn_cooldown',
  'game_tools_monster_spawn_duration', 'game_tools_monster_spawn_allow_boss'];
 for (const type of ['common','heal','use','equip','card'])
  for (const suffix of ['', '_boss', '_mvp']) keys.push(`item_rate_${type}${suffix}`);
 const values = Object.fromEntries(keys.map(key => [key,100]));
 const definitions = Object.fromEntries(keys.map(key => [key,{minimum:0,maximum:1000000,unit:'percent'}]));
 values.refine_chance_rate=250;values.refine_always_success=guaranteed;
 definitions.refine_always_success={minimum:0,maximum:1,unit:'boolean'};
 loadAdventureGameSettings.mockResolvedValue({values,definitions});
 applyAdventureGameSettings.mockImplementation(async changes=>({values:{...values,...changes}}));
 return {values,definitions};
}
async function mount(mobile, guaranteed=0){
 fixture(guaranteed);
 const container=document.createElement('div');document.body.replaceChildren(container);
 const dispose=GameSettingsTab.mount(container,{mobile});
 await vi.waitFor(()=>expect(container.querySelectorAll('.settings-drop-table input')).toHaveLength(15));
 return {container,dispose};
}
function toggle(container,value){
 const select=container.querySelector('[name=refine_always_success]').closest('.game-select');
 select.querySelector('.game-select-trigger').click();
 select.querySelector(`[data-value="${value}"]`).click();
}
const submit=container=>container.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true}));

it.each([false,true])('renders drop categories and saves Mini independently (mobile: %s)', async mobile=>{
 const {container,dispose}=await mount(mobile);
 expect([...container.querySelectorAll('.settings-drop-table thead th')].map(node=>node.textContent)).toEqual(['物品类型','普通（倍）','Mini（倍）','MVP（倍）']);
 expect(container.querySelector('.settings-drop-table em')).toBeNull();
 container.querySelector('[name=item_rate_card_boss]').value='10000';
 container.querySelector('[name=item_rate_heal_boss]').value='2.5';submit(container);
 await vi.waitFor(()=>expect(applyAdventureGameSettings).toHaveBeenCalledWith({item_rate_card_boss:1000000,item_rate_heal_boss:250}));
 expect(container.querySelector('[name=item_rate_card]').value).toBe('1');
 expect(container.querySelector('[name=item_rate_card_mvp]').value).toBe('1');
 dispose();
});
it.each([false,true])('preserves a disabled multiplier and resumes it when guarantee is off (mobile: %s)',async mobile=>{
 const {container,dispose}=await mount(mobile);let rate=container.querySelector('[name=refine_chance_rate]');
 expect(rate.value).toBe('2.5');rate.value='3.25';toggle(container,1);
 expect(rate.disabled).toBe(true);submit(container);
 await vi.waitFor(()=>expect(applyAdventureGameSettings).toHaveBeenLastCalledWith({refine_chance_rate:325,refine_always_success:1}));
 await vi.waitFor(()=>expect(container.querySelector('[name=refine_chance_rate]').disabled).toBe(true));
 rate=container.querySelector('[name=refine_chance_rate]');expect(rate.value).toBe('3.25');toggle(container,0);
 expect(rate.disabled).toBe(false);expect(rate.value).toBe('3.25');submit(container);
 await vi.waitFor(()=>expect(applyAdventureGameSettings).toHaveBeenLastCalledWith({refine_always_success:0}));dispose();
});
it('does not submit a disabled multiplier as zero and retains disabling after cancellation',async()=>{
 const {container,dispose}=await mount(true,1);submit(container);
 expect(applyAdventureGameSettings).not.toHaveBeenCalled();
 container.querySelector('[name=base_exp_rate]').value='2';requestConfirmation.mockResolvedValue(false);submit(container);
 await vi.waitFor(()=>expect(requestConfirmation).toHaveBeenCalledOnce());
 await vi.waitFor(()=>expect(container.querySelector('button[type=submit]').disabled).toBe(false));
 expect(container.querySelector('[name=refine_chance_rate]').disabled).toBe(true);
 expect(applyAdventureGameSettings).not.toHaveBeenCalled();dispose();
});
