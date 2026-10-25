import DB from 'DB/DBManager.js';
import EntityManager from 'Renderer/EntityManager.js';
import { loadNPCIllustration } from './NPCIllustration.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import {
	interactionSnapshot,
	showInteraction,
	clearInteraction,
	subscribeInteraction
} from 'UI/Game/ServerInteraction.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

let cutinImage = '';
let cutinGeneration = 0;
subscribeInteraction(state => {
	if (!state) {
		cutinImage = '';
		cutinGeneration++;
	}
});
function send(Packet, id, fields = {}) {
	const packet = new Packet();
	Object.assign(packet, fields, { NAID: id });
	Network.sendPacket(packet);
}
function npcTitle(id) {
	return EntityManager.get(id)?.display.name?.split('#')[0] || '对话';
}
function stateFor(id) {
	const current = interactionSnapshot();
	return current?.kind === 'npc' && current.id === id
		? current
		: { kind: 'npc', id, title: npcTitle(id), lines: [], mode: 'waiting', image: cutinImage };
}
function close(id) {
	send(PACKET.CZ.CLOSE_DIALOG, id);
	clearInteraction('npc');
}
function present(state) {
	const token = {};
	showInteraction({
		...state,
		token,
		canClose: state.mode === 'menu' || state.mode === 'close',
		close: () => {
			if (interactionSnapshot()?.token !== token) return;
			if (state.mode === 'menu') {
				send(PACKET.CZ.CHOOSE_MENU, state.id, { num: 255 });
				clearInteraction('npc');
			} else if (state.mode === 'close') close(state.id);
		},
		respond: value => {
			if (interactionSnapshot()?.token !== token || state.mode === 'waiting')
				return false;
			const mode = state.mode;
			if (
				mode === 'number' &&
				(!/^-?\d+$/.test(String(value)) || Number(value) < -2147483648 || Number(value) > 2147483647)
			)
				return '请输入有效的整数';
			if (mode === 'menu' && !state.options.some(option => option.value === value)) return '请选择有效选项';
			if (mode === 'next') {
				// A new page must not inherit text or a late-loading portrait from the previous page.
				cutinImage = '';
				cutinGeneration++;
				present({ ...state, lines: [], image: '', options: [], mode: 'waiting', awaiting: true });
			} else present({ ...state, mode: 'waiting', awaiting: true });
			if (mode === 'next') send(PACKET.CZ.REQ_NEXT_SCRIPT, state.id);
			if (mode === 'close') close(state.id);
			if (mode === 'menu') send(PACKET.CZ.CHOOSE_MENU, state.id, { num: value });
			if (mode === 'text') send(PACKET.CZ.INPUT_EDITDLGSTR, state.id, { msg: String(value) });
			if (mode === 'number') send(PACKET.CZ.INPUT_EDITDLG, state.id, { value: Number(value) });
			return true;
		}
	});
}
export const mobileNPC = {
	message(pkt) {
		const state = stateFor(pkt.NAID);
		const text = String(pkt.msg ?? '').replace(/^\[([^\]]+)\]/, (_, name) => `[${DB.getNpcName(name)}]`);
		present({ ...state, lines: [...(state.awaiting ? [] : state.lines), text], awaiting: false, mode: 'waiting' });
	},
	next: pkt => present({ ...stateFor(pkt.NAID), mode: 'next' }),
	closeButton(pkt) {
		const state = interactionSnapshot();
		// Script cleanup can follow an openstorage packet in the same network frame.
		// It belongs to the old dialog and must not replace the new server window.
		if (state?.kind === 'npc' && state.id === pkt.NAID) present({ ...state, mode: 'close' });
	},
	closeScript(pkt) {
		if (interactionSnapshot()?.id === pkt.NAID) clearInteraction('npc');
	},
	menu(pkt) {
		const options = pkt.msg
			.split(':')
			.filter(Boolean)
			.map((text, index) => ({ value: index + 1, text: toPlainRagnarokText(text) }));
		present({ ...stateFor(pkt.NAID), mode: 'menu', options });
	},
	input: pkt =>
		present({ ...stateFor(pkt.NAID), mode: pkt instanceof PACKET.ZC.OPEN_EDITDLGSTR ? 'text' : 'number' }),
	deal(pkt) {
		const token = {};
		showInteraction({
			kind: 'deal',
			title: npcTitle(pkt.NAID),
			token,
			close: () => clearInteraction('deal'),
			respond: type => {
				if (interactionSnapshot()?.token !== token || ![0, 1].includes(type)) return;
				clearInteraction('deal');
				send(PACKET.CZ.ACK_SELECT_DEALTYPE, pkt.NAID, { type });
			}
		});
	},
	cutin(pkt) {
		const generation = ++cutinGeneration;
		cutinImage = '';
		const state = interactionSnapshot();
		if (state?.kind === 'npc') showInteraction({ ...state, image: '' });
		if (!pkt.imageName || ![0, 1, 2, 3, 4].includes(pkt.type)) return;
		loadNPCIllustration(pkt.imageName, image => {
			if (generation !== cutinGeneration) return;
			cutinImage = image;
			const latest = interactionSnapshot();
			if (latest?.kind === 'npc') showInteraction({ ...latest, image });
		});
	}
};
