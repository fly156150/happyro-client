import { describe, expect, it } from 'vitest';
import { buildNpcInstanceNames } from '../../scripts/npc-instance-names.mjs';

describe('NPC names at shared coordinates', () => {
	const trigger = { map: 'izlude', x: 126, y: 53, display_name: '希鲁德', source_name: '希鲁德', display_sprite_id: null, game_visible: false };
	const actor = { ...trigger, display_name: '席鲁德', source_name: '席鲁德', display_sprite_id: 50 };
	it('chooses the illustrated actor regardless of trigger order', () => {
		for (const entries of [[trigger, actor], [actor, trigger]]) {
			expect(buildNpcInstanceNames(entries)['izlude:126:53'].name).toBe('席鲁德');
		}
	});
	it('prioritizes an accessible NPC and keeps separate positions independent', () => {
		const visible = { ...actor, display_name: '可交互角色', game_visible: true };
		const other = { ...actor, x: 127, display_name: '另一角色' };
		expect(buildNpcInstanceNames([trigger, actor, visible, other])).toMatchObject({
			'izlude:126:53': { name: '可交互角色' },
			'izlude:127:53': { name: '另一角色' }
		});
	});
});
