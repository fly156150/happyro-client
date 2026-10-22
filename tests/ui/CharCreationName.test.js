import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

import { validateSocialText } from '../../src/Utils/SocialText.js';

const source = readFileSync('src/Engine/CharEngine.js', 'utf8');
const handler = source.match(/function onCharCreationRequest\([^]*?\n\}/)[0];

function submit(name) {
	const sendPacket = vi.fn();
	const showMessageBox = vi.fn();
	const context = {
		validateSocialText,
		PACKETVER: { value: 20211103 },
		PACKET: { CH: { MAKE_CHAR3: class {} } },
		Network: { sendPacket },
		UIManager: { showMessageBox },
		_creationSlot: 0
	};
	runInNewContext(handler, context);
	context.onCharCreationRequest(name, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1);
	return { sendPacket, showMessageBox };
}

describe('character creation names', () => {
	it.each(['中', 'A', '  中  '])('accepts and trims a single-character name: %s', name => {
		const { sendPacket, showMessageBox } = submit(name);
		expect(sendPacket).toHaveBeenCalledWith(expect.objectContaining({ name: name.trim() }));
		expect(showMessageBox).not.toHaveBeenCalled();
	});

	it.each(['', '   ', '\u3000'])('rejects an empty or whitespace-only name: %j', name => {
		const { sendPacket, showMessageBox } = submit(name);
		expect(sendPacket).not.toHaveBeenCalled();
		expect(showMessageBox).toHaveBeenCalledWith('请输入角色名', 'ok');
	});
});
