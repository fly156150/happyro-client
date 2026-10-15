import { expect, it, vi } from 'vitest';
vi.mock('UI/Components/GameTools/MapCatalogTab.js', () => ({ default: {id:'maps',label:'地图',mount:()=>{}} }));
vi.mock('UI/Components/GameTools/MonsterCatalogTab.js', () => ({ default: {id:'monsters',label:'魔物',mount:()=>{}} }));
vi.mock('UI/Components/GameTools/NpcCatalogTab.js', () => ({ default: {id:'npcs',label:'NPC',mount:()=>{}} }));
vi.mock('UI/Components/GameTools/ItemCatalogTab.js', () => ({ default: {id:'items',label:'物品',capability:'adminAvailable',mount:()=>{}} }));
vi.mock('UI/Components/GameTools/CharacterMaintenanceTab.js', () => ({ default: {id:'character',label:'角色',capability:'characterMaintenanceAllowed',mount:()=>{}} }));
vi.mock('UI/Components/GameTools/GameSettingsTab.js', () => ({ default: {id:'settings',label:'设置',capability:'gameSettingsAllowed',mount:()=>{}} }));
import { availableGameToolsTabs } from '../../src/UI/Components/GameTools/GameToolsTabs.js';
it('shares all six features across presentations and filters privileged features by server capability', () => {
	expect(availableGameToolsTabs({adminAvailable:true,characterMaintenanceAllowed:true,gameSettingsAllowed:true}).map(t=>t.id)).toEqual(['maps','monsters','items','npcs','character','settings']);
	expect(availableGameToolsTabs({}).map(t=>t.id)).toEqual(['maps','monsters','npcs']);
	expect(availableGameToolsTabs({adminAvailable:true}).map(t=>t.id)).toEqual(['maps','monsters','items','npcs']);
});
