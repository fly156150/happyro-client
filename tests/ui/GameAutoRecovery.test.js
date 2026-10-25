vi.mock('UI/Components/GameTools/AdventureControlService.js', () => ({ loadAdventureAsset: vi.fn() }));
import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ session: {}, items: [], use: vi.fn(), npc: {__active:false}, map: {mapPending:false}, teleport: false }));
vi.mock('Engine/SessionStorage.js', () => ({default:s.session}));
vi.mock('UI/Components/NpcBox/NpcBox.js', () => ({default:s.npc}));
vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({getAdventureActionState:()=>s.map}));
vi.mock('UI/Game/AutoCombatTeleport.js', () => ({isAutoCombatTeleportPending:()=>s.teleport}));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({default:{getUI:()=>({list:s.items,onUseItem:s.use})}}));
vi.mock('DB/DBManager.js', () => ({default:{getItemName:item=>String(item.ITID),getItemInfo:id=>({identifiedDisplayName:String(id)})}}));
import {createGameAutoRecovery,recoveryItems} from '../../src/UI/Game/GameAutoRecovery.js';
import {defaultRecoverySettings} from '../../src/UI/Game/RecoverySettings.js';
import {itemUseExecution} from '../../src/Network/ItemUseExecution.js';
import {recoveryDefinition} from '../../src/DB/Items/RecoveryItems.js';
beforeEach(()=>{
 itemUseExecution.reset(); vi.clearAllMocks(); s.npc.__active=false;s.map.mapPending=false;s.teleport=false;
 s.session.Entity={life:{hp:10,hp_max:100,sp:0,sp_max:100},cast:{display:true},action:1};
 s.items=[{ITID:501,index:2,count:2,type:0},{ITID:505,index:3,count:2,type:0},{ITID:506,index:4,count:2,type:0}];
 s.use.mockReturnValue(true);
});
function settings(){const v=defaultRecoverySettings();v.hp.enabled=true;v.hp.items=[501];v.sp.enabled=true;v.sp.items=[505];return v;}
it('admits actual HP/SP effects and excludes status-only green potions',()=>{
 expect(recoveryItems().map(item=>item.id)).toEqual([501,505]);
 expect(recoveryDefinition(500)).toMatchObject({hp:true,sp:true,mode:'percent'});
 expect(recoveryDefinition(607)).toMatchObject({cooldownMs:5000,cooldownGroup:'Reuse_Limit_F'});
});
it('can recover during a cast or walk without cancelling either',()=>{
 const runner=createGameAutoRecovery(()=>true);runner.tick(settings(),true);
 expect(s.use).toHaveBeenCalledWith(2,expect.objectContaining({source:'automation',complete:expect.any(Function)}));
 expect(s.session.Entity.cast.display).toBe(true);expect(s.session.Entity.action).toBe(1);
});
it.each(['npc','map','teleport','stopped'])('sends nothing while %s prevents recovery',reason=>{
 s.npc.__active=reason==='npc';s.map.mapPending=reason==='map';s.teleport=reason==='teleport';
 createGameAutoRecovery(()=>reason!=='stopped').tick(settings(),true);expect(s.use).not.toHaveBeenCalled();
});
