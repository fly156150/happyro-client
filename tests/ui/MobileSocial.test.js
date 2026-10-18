import {beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({session:{Playing:true,hasGuild:true,isGuildMaster:true,guildRight:0,guildName:'公会',AID:1,GID:2,Entity:{GUID:10}},guild:{info:null,notice:{subject:'公告',notice:'内容'},members:[],positions:[{positionID:1,posName:'会员',ranking:1,right:0,payRate:0}],relations:[{GDID:20,relation:0,guildName:'盟友'}],history:[],skills:[{SKID:10001,level:1,type:4,upgradable:true}],points:2},social:{friends:[],party:[],options:{}},entities:[],addFriend:vi.fn(),removeFriend:vi.fn(),createParty:vi.fn(),inviteParty:vi.fn(),leaveParty:vi.fn(),expelParty:vi.fn(),leadParty:vi.fn(),options:vi.fn(),learn:vi.fn(),emblem:vi.fn(),configure:vi.fn(()=>true),position:vi.fn(),relation:vi.fn(),ally:vi.fn(),hostile:vi.fn()}));
vi.mock('Engine/SessionStorage.js',()=>({default:state.session}));
vi.mock('Renderer/Entity/Entity.js',()=>({default:{TYPE_PC:0}}));
vi.mock('Renderer/MapRenderer.js',()=>({default:{currentMap:'prontera.rsw'}}));
vi.mock('Renderer/EntityManager.js',()=>({default:{forEach:fn=>state.entities.forEach(fn)}}));
vi.mock('UI/Components/PartyFriends/PartyFriends.js',()=>({default:{getUI:()=>({getSocialSnapshot:()=>state.social})}}));
vi.mock('UI/Components/Guild/Guild.js',()=>({default:{getSocialSnapshot:()=>state.guild,onIncreaseSkill:state.learn,onSendEmblem:state.emblem}}));
vi.mock('Engine/MapEngine/Friends.js',()=>({default:{addFriend:state.addFriend,removeFriend:state.removeFriend,detailsFor:friend=>friend.State===0?state.details:undefined}}));
vi.mock('Engine/MapEngine/Group.js',()=>({default:{onRequestCreation:state.createParty,onRequestInvitation:state.inviteParty,onRequestLeave:state.leaveParty,onRequestExpel:state.expelParty,onRequestChangeLeader:state.leadParty,onRequestInfoUpdate:state.options}}));
vi.mock('Engine/MapEngine/Guild.js',()=>({default:{requestPositionUpdate:state.position,requestDeleteRelatedGuild:state.relation,requestAlliance:state.ally,requestHostility:state.hostile,requestAccess:vi.fn(),requestInfo:vi.fn()}}));
vi.mock('DB/DBManager.js',()=>({default:{getMapName:code=>code==='prontera.rsw'?'普隆德拉':'未知地图',getSkillDescription:()=> '公会技能说明'}}));
vi.mock('DB/Skills/SkillInfo.generated.js',()=>({default:{10001:{SkillName:'公会技能'}}}));
import {createGameSocial} from '../../src/UI/Game/GameSocial.js';
import {createSocialPanel} from '../../src/UI/Mobile/game/SocialPanel.js';
beforeEach(()=>{vi.clearAllMocks();state.session.isGuildMaster=true;state.session.Playing=true;state.entities=[];state.details=undefined;state.session.Entity.GUID=10;state.guild.skills[0].level=1;state.guild.points=2;state.session.hasParty=false;state.session.isPartyLeader=false;state.social.party=[];state.social.friends=[];});
it('checks current master rights, position identity and tax bounds before sending a rank edit',()=>{
 const service=createGameSocial(()=>true),data={position:1,name:'成员',tax:25,right:17};
 state.session.isGuildMaster=false;expect(service.act('editGuildPosition',data)).toContain('无效');state.session.isGuildMaster=true;
 expect(service.act('editGuildPosition',{...data,tax:51})).toContain('无效');expect(service.act('editGuildPosition',{...data,position:9})).toContain('无效');expect(state.position).not.toHaveBeenCalled();
 service.act('editGuildPosition',data);expect(state.position).toHaveBeenCalledExactlyOnceWith([{positionID:1,ranking:1,right:17,posName:'成员',payRate:25}]);
});
it('requires a nearby player of another guild and rejects stale relation removal',()=>{
 const service=createGameSocial(()=>true);state.entities=[{objecttype:1,display:{name:'目标'},GUID:20,GID:99}];service.act('guildAlliance',{name:'目标'});expect(state.ally).not.toHaveBeenCalled();state.entities[0].objecttype=0;
 service.act('guildAlliance',{name:'目标'});expect(state.ally).toHaveBeenCalledExactlyOnceWith(99);service.act('guildHostility',{name:'目标'});expect(state.hostile).toHaveBeenCalledExactlyOnceWith(99);
 service.act('removeGuildRelation',{GDID:21,relation:0});expect(state.relation).not.toHaveBeenCalled();service.act('removeGuildRelation',{GDID:20,relation:0});expect(state.relation).toHaveBeenCalledExactlyOnceWith(20,0);
});
it('renders rank management and requires a second confirmation without sending during initial render',()=>{
 const body=document.body.appendChild(document.createElement('div'));createSocialPanel(body,createGameSocial(()=>true,{slotName:()=> '空槽位',configure:state.configure}),vi.fn());body.querySelector('[data-social-tab=guild]').click();
 const tax=body.querySelector('[aria-label="职位 1 经验税率（0–50）"]');expect(tax).not.toBeNull();tax.value='20';const form=tax.closest('form');form.dispatchEvent(new Event('submit',{cancelable:true}));expect(state.position).not.toHaveBeenCalled();body.querySelector('dialog [data-confirm]').click();expect(state.position).toHaveBeenCalledOnce();
});

it('locks a guild skill upgrade until server state changes, then binds only an authorized learned level',()=>{
 const service=createGameSocial(()=>true,{configure:state.configure});service.act('learnGuildSkill',{id:10001,level:2});service.act('learnGuildSkill',{id:10001,level:2});expect(state.learn).toHaveBeenCalledExactlyOnceWith(10001);
 state.guild.skills[0].level=2;state.guild.points=1;service.act('learnGuildSkill',{id:10001,level:3});expect(state.learn).toHaveBeenCalledTimes(2);
 service.act('bindGuildSkill',{id:10001,level:3,slot:0});expect(state.configure).not.toHaveBeenCalled();service.act('bindGuildSkill',{id:10001,level:2,slot:0});expect(state.configure).toHaveBeenCalledExactlyOnceWith(0,{isSkill:true,ID:10001},2);
 state.session.isGuildMaster=false;service.act('bindGuildSkill',{id:10001,level:2,slot:0});expect(state.configure).toHaveBeenCalledOnce();
});
it('validates emblem bytes and rechecks the guild after asynchronous file reading',async()=>{
 const service=createGameSocial(()=>true);const file={size:6,arrayBuffer:async()=>new Uint8Array([71,73,70,56,57,97]).buffer};
 await service.uploadEmblem({size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer});expect(state.emblem).not.toHaveBeenCalled();
 const changed={...file,arrayBuffer:async()=>{state.session.Entity.GUID=11;return file.arrayBuffer();}};expect(await service.uploadEmblem(changed)).toContain('变化');expect(state.emblem).not.toHaveBeenCalled();
 await service.uploadEmblem(file);expect(state.emblem).toHaveBeenCalledOnce();
});
it('updates an asynchronously loaded emblem without replacing the notice draft',()=>{
 const body=document.body.appendChild(document.createElement('div')),panel=createSocialPanel(body,createGameSocial(()=>true,{slotName:()=> '空槽位'}),vi.fn());body.querySelector('[data-social-tab=guild]').click();const notice=body.querySelector('[aria-label="公告内容"]');notice.value='尚未提交的公告';state.guild.emblem='data:image/gif;base64,R0lGODlh';panel.update();expect(body.querySelector('[aria-label="公告内容"]')).toBe(notice);expect(notice.value).toBe('尚未提交的公告');expect(body.querySelector('[data-guild-emblem]').hidden).toBe(false);
});

it('resolves a friend by both server identifiers and denies stale or externally blocked actions',()=>{
 state.social.friends=[{AID:11,GID:12,Name:'好友A'},{AID:13,GID:14,Name:'好友B'}];const service=createGameSocial(()=>true);
 service.act('removeFriend',{AID:13,GID:15});expect(state.removeFriend).not.toHaveBeenCalled();service.act('removeFriend',{AID:13,GID:14});expect(state.removeFriend).toHaveBeenCalledExactlyOnceWith(1);
 service.act('addFriend',{name:' 新好友 '});expect(state.addFriend).toHaveBeenCalledExactlyOnceWith('新好友');createGameSocial(()=>false).act('addFriend',{name:'不可发送'});expect(state.addFriend).toHaveBeenCalledOnce();
});
it('checks party membership and current leadership for invites, expulsion, leadership and settings',()=>{
 const service=createGameSocial(()=>true);service.act('createParty',{name:'测试队伍'});expect(state.createParty).toHaveBeenCalledExactlyOnceWith('测试队伍',0,0);state.session.hasParty=true;state.social.party=[{AID:77,characterName:'队员'}];
 service.act('inviteParty',{name:'新人'});service.act('expelParty',{AID:77});expect(state.inviteParty).not.toHaveBeenCalled();expect(state.expelParty).not.toHaveBeenCalled();state.session.isPartyLeader=true;
 service.act('inviteParty',{name:'新人'});service.act('leadParty',{AID:77});service.act('expelParty',{AID:77});expect(state.inviteParty).toHaveBeenCalledExactlyOnceWith(0,'新人');expect(state.leadParty).toHaveBeenCalledExactlyOnceWith(77);expect(state.expelParty).toHaveBeenCalledExactlyOnceWith(77,'队员');
 service.act('partyOptions',{exp:9,pickup:0,division:0});expect(state.options).not.toHaveBeenCalled();service.act('partyOptions',{exp:1,pickup:0,division:1});expect(state.options).toHaveBeenCalledExactlyOnceWith(1,0,1);service.act('leaveParty');expect(state.leaveParty).toHaveBeenCalledOnce();
});

it('rejects UTF-8 overflow before creating a party and accepts a name fitting 23 bytes',()=>{
 const service=createGameSocial(()=>true);
 expect(service.act('createParty',{name:'a'+'中'.repeat(8)})).toContain('23 字节');
 expect(state.createParty).not.toHaveBeenCalled();
 const name='ab'+'中'.repeat(7);
 expect(service.act('createParty',{name})).toBe('已请求，等待服务器回复');
 expect(state.createParty).toHaveBeenCalledWith(name,0,0);
});
it('rejects oversized announcements and reasons without truncating or sending them',()=>{
 const service=createGameSocial(()=>true);
 expect(service.act('guildNotice',{subject:'中'.repeat(20),notice:''})).toContain('59 字节');
 expect(service.act('guildNotice',{subject:'标题',notice:'中'.repeat(40)})).toContain('119 字节');
 expect(service.act('leaveGuild',{reason:'中'.repeat(14)})).toContain('39 字节');
});

it('highlights management and selected members consistently, including self without self actions',()=>{
 const body=document.body.appendChild(document.createElement('div'));
 const self={AID:1,GID:2,Name:'自己',characterName:'自己',CharName:'自己'};
 const peer={AID:3,GID:4,Name:'别人',characterName:'别人',CharName:'别人'};
 self.life={entity:self};peer.life={entity:peer};
 state.social.friends=[peer];state.social.party=[self,peer];state.guild.members=[self,peer];
 state.session.hasParty=true;state.session.isPartyLeader=true;
 const whisper=vi.fn(),panel=createSocialPanel(body,createGameSocial(()=>true,{slotName:()=>''}),whisper);
 for(const type of ['friends','party','guild']){
  body.querySelector('[data-social-tab='+type+']').click();
  const list=body.querySelector('.inventory-list');
  expect(list.querySelector('[aria-pressed=true]').textContent).toContain('管理');
  list.querySelector('[data-member="3:4"]').click();
  expect(list.querySelectorAll('[aria-pressed=true]')).toHaveLength(1);
  expect(list.querySelector('[aria-pressed=true]').textContent).toContain('别人');
  panel.update();expect(list.querySelector('[data-member="3:4"]').getAttribute('aria-pressed')).toBe('true');
  if(type!=='friends'){
   list.querySelector('[data-member="1:2"]').click();
   expect(body.querySelector('.inventory-detail').textContent).toContain('（自己）');
   const enabled=[...body.querySelectorAll('button:not(:disabled)')].map(b=>b.textContent);
   expect(enabled).not.toContain('私聊');expect(enabled).not.toContain('转交队长');
   expect(enabled).not.toContain('移出队伍');expect(enabled).not.toContain('移出公会');
   expect(enabled).not.toContain('设置职位');
  }
 }
 expect(whisper).not.toHaveBeenCalled();
 state.guild.members=[];
});

it('rejects changing the current guild masters own position',()=>{
 state.guild.members=[{AID:1,GID:2}];
 expect(createGameSocial(()=>true).act('guildPosition',{AID:1,GID:2,position:1})).toBe('成员或职位已变化');
 state.guild.members=[];
});

it('shows known friend levels and Chinese maps without reusing offline locations',()=>{
 state.social.friends=[{AID:9,GID:8,Name:'好友',State:0}];
 state.details={baseLevel:80,mapName:'prontera'};
 const service=createGameSocial(()=>true),body=document.body.appendChild(document.createElement('div'));
 const panel=createSocialPanel(body,service,vi.fn());
 body.querySelector('[data-member="9:8"]').click();
 expect(body.querySelector('.social-member-facts').textContent).toContain('Lv.80');
 expect(body.querySelector('.social-member-facts').textContent).toContain('普隆德拉');
 state.details={baseLevel:81,mapName:'prontera'};
 panel.update();expect(body.querySelector('.social-member-facts').textContent).toContain('Lv.81');
 state.social.friends[0].State=1;panel.update();
 expect(body.querySelector('.social-member-facts').textContent).not.toContain('普隆德拉');
 expect(body.querySelector('.social-member-facts').textContent).toBe('等级未知地图未知');
});
