import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('UI/Components/Navigation/NaviActionService.js',()=>({ prepareNaviLinks:vi.fn(), isNaviAvailable:vi.fn(()=>true), activateNavi:vi.fn(),handleNaviClick:vi.fn()}));
const s=vi.hoisted(()=>({quests:[],send:vi.fn(),playing:true,allowed:true}));
vi.mock('UI/Components/Quest/Quest.js',()=>({default:{getUI:()=>({getQuests:()=>s.quests})}}));
vi.mock('Network/NetworkManager.js',()=>({default:{sendPacket:s.send}}));
vi.mock('Network/PacketStructure.js',()=>({default:{CZ:{ACTIVE_QUEST:class {}}}}));
vi.mock('Engine/SessionStorage.js',()=>({default:{get Playing(){return s.playing;}}}));
vi.mock('DB/DBManager.js',()=>({default:{getItemInfo:()=>({identifiedDisplayName:'药水'})}}));
import {createGameQuests} from '../../src/UI/Game/GameQuests.js';
import {createQuestsPanel} from '../../src/UI/Mobile/game/QuestsPanel.js';
beforeEach(()=>{vi.clearAllMocks();s.playing=true;s.allowed=true;s.quests=[{questID:1,active:1,title:'^ff0000任务',description:'<NAVI>城门<INFO>prontera,100,200</INFO></NAVI>',hunt_list:[{mobName:'波利',huntCount:2,maxCount:5}],reward_item_list:[{ItemID:501,ItemNum:3}]}];});
it('waits for server state and rejects stale, completed or disconnected requests',()=>{
 const service=createGameQuests(()=>s.allowed);expect(service.snapshot().quests[0].targets).toEqual([{id:'prontera',name:'城门',x:100,y:200,naviInfo:'prontera,100,200',inline:true}]);
 expect(service.toggle(1,0)).toBe(false);expect(service.toggle(1,1)).toBe(true);expect(service.toggle(1,1)).toBe(false);expect(s.quests[0].active).toBe(1);expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({questID:1,active:0}));
 s.quests[0].active=0;expect(service.snapshot().pending).toBeUndefined();s.allowed=false;expect(service.toggle(1,0)).toBe(false);s.allowed=true;s.playing=false;expect(service.toggle(1,0)).toBe(false);s.playing=true;s.quests[0].active=2;expect(service.toggle(1,2)).toBe(false);
});
it('updates progress without replacing list nodes and opens navigation targets without HTML execution',()=>{
 const body=document.createElement('div');const service=createGameQuests(()=>true);const activateNavi=vi.fn();const panel=createQuestsPanel(body,{...service,activateNavi});
 const button=body.querySelector('[data-quest]');expect(button.getAttribute('aria-pressed')).toBe('true');expect(body.textContent).toContain('波利：2 / 5');button.click();expect(body.textContent).toContain('波利：2 / 5');expect(body.querySelector('navi')).toBeNull();
 s.quests[0].hunt_list[0].huntCount=3;panel.update();expect(body.querySelector('[data-quest]')).toBe(button);expect(body.textContent).toContain('波利：3 / 5');
 expect(body.querySelector('[data-navi-info]').textContent).toBe('城门');expect(body.querySelector('[data-navi-info]').dataset.naviInfo).toBe('prontera,100,200');
 s.quests=[];panel.update();expect(body.textContent).toContain('当前分类没有任务');expect(body.textContent).not.toContain('波利');
});
