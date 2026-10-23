import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = fs.readFileSync('src/Engine/MapEngine.js', 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('let mapLoadGeneration = 0;');
const end = source.indexOf('\n/**\n * @type {boolean} is initialized', start);

if (start < 0 || end <= start) throw new Error('MapEngine integration boundary missing');

function integration() {
	let options;
	const controller = { begin: vi.fn(), loaded: vi.fn(), failed: vi.fn(), handleResult: vi.fn(), updateContext: vi.fn(), cancel: vi.fn() };
	const sent = [], order = [];
	const scope = {
		document: {},
		createMapLoadRecoveryView: () => ({}),
		createMapLoadRecovery: config => { options = config; return controller; },
		MapRenderer: { cancelLoad: vi.fn(() => order.push('cancel-renderer')) },
		PACKET: { CZ: { HAPPYRO_MAP_RECOVERY: function () {} } },
		Network: { sendPacket: packet => {
			order.push('send-recovery');
			sent.push({ packet, generationAtSend: vm.runInContext('mapLoadGeneration', scope) });
		} },
		onMapChange: vi.fn(), onExitRequest: vi.fn()
	};
	vm.createContext(scope);
	vm.runInContext(source.slice(start, end), scope);
	return { scope, options, controller, sent, order, run: text => vm.runInContext(text, scope) };
}

describe('map engine recovery integration', () => {
	it('invalidates the old map callback before sending the recovery request', () => {
		const t = integration();
		t.run('mapLoadContext = {generation: 17, pending: 1};');
		const capturedOldGeneration = t.run('mapLoadGeneration');
		t.options.onRecover('prontera', { generation: 17 });
		expect(t.order).toEqual(['cancel-renderer', 'send-recovery']);
		expect(t.sent[0].generationAtSend).toBeGreaterThan(capturedOldGeneration);
		expect(t.sent[0].packet).toMatchObject({ generation: 17, action: 1 });
		expect(t.run('mapLoadContext.pending')).toBe(1);
		expect(t.controller.cancel).not.toHaveBeenCalled();
	});
	it('refuses stale or already completed context without canceling a current map', () => {
		const t = integration();
		t.run('mapLoadContext = {generation: 18, pending: 1};');
		expect(() => t.options.onRecover('previous', { generation: 17 })).toThrow();
		t.run('mapLoadContext.pending = 0;');
		expect(() => t.options.onRecover('previous', { generation: 18 })).toThrow();
		expect(t.order).toEqual([]);
	});
	it('updates restored attempt metadata without beginning another load or accepting old confirmations', () => {
		const t = integration();
		t.scope.onMapLoadContext({ generation: 23, pending: 1, attempt: 0 });
		t.scope.onMapLoadContext({ generation: 23, pending: 1, attempt: 2 });
		expect(t.controller.updateContext).toHaveBeenCalledExactlyOnceWith({ generation: 23, pending: 1, recoveryMode: 'prontera' });
		expect(t.controller.begin).not.toHaveBeenCalled();
		t.scope.onMapLoadContext({ generation: 22, pending: 0, attempt: 0 });
		expect(t.controller.loaded).not.toHaveBeenCalled();
		t.scope.onMapLoadContext({ generation: 23, pending: 0, attempt: 0 });
		expect(t.controller.loaded).toHaveBeenCalledOnce();
	});
	it('filters stale recovery results and retries locally without sending a new warp', () => {
		const t = integration();
		t.run('mapLoadContext = {generation: 2, pending: 1}; activeMapPacket = {mapName:"prontera.gat", xPos:146, yPos:89};');
		t.scope.onMapRecoveryResult({ generation: 1, status: 2 });
		expect(t.controller.handleResult).not.toHaveBeenCalled();
		t.scope.onMapRecoveryResult({ generation: 2, status: 4 });
		expect(t.controller.handleResult).toHaveBeenCalledExactlyOnceWith({ generation: 2, status: 4 });
		t.options.onRetry();
		expect(t.scope.onMapChange).toHaveBeenCalledExactlyOnceWith({ mapName: 'prontera.gat', xPos: 146, yPos: 89 }, true);
		expect(t.sent).toEqual([]);
	});
});
