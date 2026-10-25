import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

function handler(file, name, values = {}) {
 const source = readFileSync(`src/Engine/MapEngine/${file}.js`, 'utf8').replaceAll('\r\n', '\n');
 const start = source.indexOf(`function ${name}(pkt)`);
 const report = vi.fn();
 const context = vm.createContext({
  reportSkillExecution: report, Session: {Entity:{GID:42}},
  EntityManager:{get:()=>null}, CombatDiagnostics:{enabled:()=>false},
  ...values
 });
 vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
 return {run:context[name], report};
}

it('reports both failure and success from the local skill acknowledgement', () => {
 const h=handler('Skill','onSkillResult', {
  skillFailMessage:()=> '失败', JobPropertyTable:{}, SkillInfo:{}, DB:{},
  ChatBox:{addText:vi.fn(),TYPE:{},FILTER:{}},isEmotionFailure:()=>false,isBasicActionLevelFailure:()=>false
 });
 h.run({SKID:19,result:0});expect(h.report).toHaveBeenLastCalledWith(19,'failed');
 h.run({SKID:19,result:1});expect(h.report).toHaveBeenLastCalledWith(19,'executed');
});
it('does not mistake a failed support effect or another actor for successful casting', () => {
 const h=handler('Entity','onEntityUseSkill');
 h.run({srcAID:9,SKID:28,result:1});expect(h.report).not.toHaveBeenCalled();
 h.run({srcAID:42,SKID:28,result:0});expect(h.report).toHaveBeenLastCalledWith(28,'failed');
 h.run({srcAID:42,SKID:28,result:1});expect(h.report).toHaveBeenLastCalledWith(28,'executed');
});
it('extends the watchdog using only the local player’s actual cast duration', () => {
 const h=handler('Entity','onEntityCastSkill');
 h.run({AID:9,SKID:19,delayTime:20000});expect(h.report).not.toHaveBeenCalled();
 h.run({AID:42,SKID:19,delayTime:20000});expect(h.report).toHaveBeenCalledExactlyOnceWith(19,'casting',20000);
});
it('recognizes the local player’s attack receipt even after the target leaves view', () => {
 const h=handler('Entity','onEntityUseSkillToAttack');
 h.run({AID:9,SKID:19});expect(h.report).not.toHaveBeenCalled();
 h.run({AID:42,SKID:19});expect(h.report).toHaveBeenCalledExactlyOnceWith(19,'executed');
});
it('recognizes ground skill feedback only from the local player', () => {
 const h=handler('Skill','onSkillToGround',{Altitude:{getCellHeight:()=>0},EffectManager:{spamSkill:vi.fn()}});
 h.run({AID:9,SKID:18});expect(h.report).not.toHaveBeenCalled();
 h.run({AID:42,SKID:18});expect(h.report).toHaveBeenCalledExactlyOnceWith(18,'executed');
});

it('only reports cast interruption for the local player', () => {
 const h=handler('Entity','onEntityCastCancel');
 h.run({AID:9});expect(h.report).not.toHaveBeenCalled();
 h.run({AID:42});expect(h.report).toHaveBeenCalledExactlyOnceWith(undefined,'cancelled');
});
