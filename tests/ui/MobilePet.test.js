vi.mock('Renderer/Renderer.js',()=>({default:{width:844,height:390}}));
import {beforeEach,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({session:{Playing:true,petId:20,Entity:{action:0,ACTION:{DIE:99}}},send:vi.fn(),entities:new Map(),inventory:[{ITID:501,count:2},{ITID:501,count:3}],selection:vi.fn()}));
vi.mock('Engine/SessionStorage.js',()=>({default:s.session}));
vi.mock('Network/NetworkManager.js',()=>({default:{sendPacket:s.send}}));
vi.mock('Network/PacketStructure.js',()=>({default:{CZ:new Proxy({}, {get:(t,k)=>t[k]||=(class{constructor(){this.packet=k;}})})}}));
vi.mock('UI/Components/Inventory/Inventory.js',()=>({default:{getUI:()=>({list:s.inventory})}}));
vi.mock('DB/DBManager.js',()=>({default:{getPetByJobID:()=>({AutoFeeding:s.autoFeedSupported}),getPetEvolutionByJob:()=>({9001:[{MaterialID:501,Amount:5}]}),getPetByEggID:()=>({PetString:'进化波利'}),getItemInfo:()=>({identifiedDisplayName:'红色药水'})}}));
vi.mock('Renderer/EntityManager.js',()=>({default:{get:id=>s.entities.get(id),forEach:fn=>s.entities.forEach(fn)}}));
vi.mock('../../src/UI/Game/GameSelection.js',()=>({openGameSelection:s.selection,selectionEntries:(ids,type)=>ids.map(id=>({id,type}))}));
import {resetGamePet,updateGamePetInfo,updateGamePetState,updateGamePetAutoFeed,receiveGamePetResult,openGamePet,openGamePetEggs,openGamePetCapture,receiveGamePetCapture} from '../../src/UI/Game/GamePet.js';
import {clearInteraction,interactionSnapshot} from '../../src/UI/Game/ServerInteraction.js';
import {createPetPanel} from '../../src/UI/Mobile/game/PetPanel.js';
const info={job:1002,szName:'波利',nLevel:10,nFullness:50,nRelationship:1000,ITID:0,bModified:0};
function open(){const p=openGamePet();p.setOperationGuard(()=>true);return p;}
beforeEach(()=>{vi.clearAllMocks();s.autoFeedSupported=true;clearInteraction();s.session.Playing=true;s.session.petId=20;s.session.Entity={action:0,ACTION:{DIE:99}};s.entities.clear();s.entities.set(20,{});s.inventory=[{ITID:501,count:2},{ITID:501,count:3}];resetGamePet();updateGamePetState({type:0,GID:20});updateGamePetInfo(info);});
it('uses server hunger and intimacy, locks feed until its result and ignores other pets',()=>{const p=open();p.command('feed');p.command('feed');expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'COMMAND_PET',cSub:1}));updateGamePetInfo({...info,nFullness:60});expect(p.snapshot().pending).toBe('feed');updateGamePetState({type:2,GID:21,data:90});expect(p.snapshot().info.nFullness).toBe(60);receiveGamePetResult('feed',0);expect(p.snapshot().message).toContain('失败');expect(p.snapshot().allowed).toBe(true);updateGamePetState({type:2,GID:20,data:70});expect(p.snapshot().info.nFullness).toBe(70);});
it('rechecks summed evolution materials and intimacy and waits for the evolution result',()=>{const p=open();expect(p.snapshot().evolutions[0].materials[0].owned).toBe(5);s.inventory[1].count=2;expect(p.command('evolve',9001)).toContain('不足');s.inventory[1].count=3;p.command('evolve',9001);p.command('evolve',9001);expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'PET_EVOLUTION',evolutionPetEggITID:9001}));expect(s.inventory[1].count).toBe(3);receiveGamePetResult('evolve',6);expect(p.snapshot().message).toBe('进化成功');});
it('validates UTF-8 names and preserves accessory semantics instead of treating hairstyle as equipment',()=>{const p=open();expect(p.command('rename','汉'.repeat(8))).toContain('无效');p.command('rename','小波利');expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({packet:'RENAME_PET',szName:'小波利'}));updateGamePetInfo({...info,szName:'小波利',bModified:1});expect(p.command('rename','其他')).toContain('改名');updateGamePetState({type:5,GID:20,data:99});expect(p.snapshot().accessory).toBe(false);updateGamePetState({type:3,GID:20,data:99});expect(p.snapshot().accessory).toBe(true);p.command('unequip');expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({cSub:4}));p.command('autofeed');expect(p.snapshot().autoFeed).toBe(false);updateGamePetAutoFeed(1);expect(p.snapshot().autoFeed).toBe(true);});
it('invalidates old modal actions, removed pets, dead owners and cross-session cached state',()=>{const p=open();p.close();p.command('feed');expect(s.send).not.toHaveBeenCalled();const next=open();s.entities.delete(20);expect(next.snapshot().info).toBeNull();next.command('feed');expect(s.send).not.toHaveBeenCalled();s.session.Entity={action:99,ACTION:{DIE:99}};expect(openGamePet()).toBeNull();s.session.Entity.action=0;resetGamePet();expect(next.snapshot().info).toBeNull();});
it('uses explicit egg selection and revalidates captured monsters, with cancellation sent to server',()=>{openGamePetEggs([2,3]);s.selection.mock.calls[0][2](3);expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({packet:'SELECT_PETEGG',index:3}));s.selection.mock.calls[0][3]();expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({index:0}));const mob={GID:100,remove_tick:0,effectColor:[1,1,1,1],boundingRect:{x1:100,x2:140,y1:100,y2:140},objecttype:5,constructor:{TYPE_MOB:5},ACTION:{DIE:99},action:0,display:{name:'波利'}};s.entities.set(100,mob);s.entities.delete(20);openGamePetCapture();const args=s.selection.mock.lastCall;expect(args[1][0].validate()).toBe(true);mob.effectColor[3]=0;expect(args[1][0].validate()).toBe(false);mob.effectColor[3]=1;mob.boundingRect.x1=900;expect(args[1][0].validate()).toBe(false);mob.boundingRect.x1=100;s.entities.delete(100);expect(args[1][0].validate()).toBe(false);args[3]();expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({targetAID:0}));receiveGamePetCapture(0);expect(interactionSnapshot()).toBeNull();});
it('requires confirmation and preserves the rename draft during status refresh',()=>{const p=open(),body=document.body.appendChild(document.createElement('div')),panel=createPetPanel(body,p);body.querySelector('[data-name]').value='草稿';body.querySelector('[data-name]').dispatchEvent(new Event('input'));updateGamePetState({type:2,GID:20,data:70});panel.update();expect(body.querySelector('[data-name]').value).toBe('草稿');body.querySelector('[data-action=feed]').click();expect(s.send).not.toHaveBeenCalled();body.querySelector('[data-confirm]').click();expect(s.send).toHaveBeenCalledOnce();});

it("does not carry an old pet pending operation into a replacement pet",()=>{const p=open();p.command("feed");s.entities.set(21,{});s.session.petId=21;updateGamePetState({type:0,GID:21});updateGamePetInfo({...info,szName:"新宠物"});expect(p.snapshot()).toMatchObject({gid:21,pending:null,allowed:true});});

it('uses Loyal intimacy and blocks evolution while an accessory is equipped',()=>{
 const p=open();
 updateGamePetInfo({...info,nRelationship:909});expect(p.snapshot().evolutions[0].ready).toBe(false);
 updateGamePetInfo({...info,nRelationship:910});expect(p.snapshot().evolutions[0].ready).toBe(true);
 updateGamePetState({type:3,GID:20,data:10013});expect(p.command('evolve',9001)).toContain('卸下');
 expect(s.send).not.toHaveBeenCalled();
 updateGamePetState({type:3,GID:20,data:0});p.command('evolve',9001);
 expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'PET_EVOLUTION'}));
});
it('disables unsupported automatic feeding and reports its reason without sending',()=>{
 s.autoFeedSupported=false;const p=open();
 expect(p.snapshot().supportsAutoFeed).toBe(false);expect(p.command('autofeed')).toContain('不支持');
 expect(s.send).not.toHaveBeenCalled();
 const body=document.createElement('div');createPetPanel(body,p);
 expect(body.querySelector('[data-action=autofeed]').disabled).toBe(true);
});
it('resets refresh feedback before each server response',()=>{
 const p=open();p.refresh();updateGamePetInfo(info);
 expect(p.snapshot().message).toBe('宠物状态已更新');
 p.refresh();expect(p.snapshot().messageKind).toBe('pending');
 updateGamePetInfo(info);expect(p.snapshot().message).toBe('宠物状态已更新');
});

it('dismisses an open pet confirmation when the owner dies or the pet disappears', () => {
 const service=open(),body=document.body.appendChild(document.createElement('div')),panel=createPetPanel(body,service);
 body.querySelector('[data-action=feed]').click();expect(body.querySelector('dialog')).not.toBeNull();
 s.session.Entity.action=s.session.Entity.ACTION.DIE;panel.update();expect(body.querySelector('dialog')).toBeNull();expect(s.send).not.toHaveBeenCalled();
 s.session.Entity.action=0;panel.update();body.querySelector('[data-action=feed]').click();
 s.entities.delete(20);panel.update();expect(body.querySelector('dialog')).toBeNull();expect(s.send).not.toHaveBeenCalled();
});

it('performs immediately without a confirmation and closes the interaction once', () => {
 const service=open(),body=document.body.appendChild(document.createElement('div'));
 createPetPanel(body,service);
 const button=body.querySelector('[data-action=perform]');
 button.click();button.click();
 expect(body.querySelector('dialog')).toBeNull();
 expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({packet:'COMMAND_PET',cSub:2}));
 expect(interactionSnapshot()).toBeNull();
});
it('keeps the pet menu open when a performance is rejected after the pet disappears', () => {
 const service=open(),body=document.body.appendChild(document.createElement('div'));
 createPetPanel(body,service);s.entities.delete(20);
 body.querySelector('[data-action=perform]').click();
 expect(s.send).not.toHaveBeenCalled();
 expect(interactionSnapshot()?.service).toBe(service);
 expect(body.querySelector('dialog')).toBeNull();
});

it('does not rebuild pet information during unchanged polling but renders server changes',()=>{
 const body=document.body.appendChild(document.createElement('div'));const panel=createPetPanel(body,open());
 const infoRoot=body.querySelector('[data-info]');const rows=[...infoRoot.children];
 for(let i=0;i<20;i++)panel.update();expect([...infoRoot.children]).toEqual(rows);
 updateGamePetInfo({...info,nFullness:60});panel.update();expect(infoRoot.textContent).toContain('60 / 100');
 const updated=[...infoRoot.children];panel.update();expect([...infoRoot.children]).toEqual(updated);
});
