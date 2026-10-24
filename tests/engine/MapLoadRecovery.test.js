import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createMapLoadRecovery, createMapLoadRecoveryView } from '../../src/Engine/MapEngine/MapLoadRecovery.js';

describe('map loading recovery', () => {
	let recovery, view, onRecover, onRetry, onExit;
	const state = () => view.show.mock.calls.at(-1)[0];
	beforeEach(() => {
		vi.useFakeTimers();
		view = { show: vi.fn(), hide: vi.fn() };
		onRecover = vi.fn(); onRetry = vi.fn(); onExit = vi.fn();
		recovery = createMapLoadRecovery({ view, onRecover, onRetry, onExit });
	});
	afterEach(() => vi.useRealTimers());
	it('automatically requests the previous location for a confirmed resource failure only once', async () => {
		const context = { token: 12, map: 'missing' };
		const id = recovery.begin(context);
		recovery.failed(new Error('missing rsw'), id);
		recovery.failed(new Error('another missing file'), id);
		await Promise.resolve();
		expect(onRecover).toHaveBeenCalledExactlyOnceWith('previous', context);
		expect(state().message).toContain('正在返回原位置');
		expect(state().onRetry).toBeNull();
	});
	it('offers explicit choices after 30 seconds without automatically moving the character', async () => {
		recovery.begin({ token: 1 });
		await vi.advanceTimersByTimeAsync(29999);
		expect(view.show).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(onRecover).not.toHaveBeenCalled();
		expect(state().onRetry).toBeTypeOf('function');
		state().onReturn();
		await Promise.resolve();
		expect(onRecover).toHaveBeenCalledWith('prontera', { token: 1 });
	});
	it('falls back from previous location to Prontera but stops at a failing safe point', async () => {
		recovery.begin({ recoveryMode: 'previous', token: 1 });
		recovery.failed('missing'); await Promise.resolve();
		expect(onRecover).toHaveBeenCalledWith('prontera', expect.anything());
		recovery.begin({ recoveryMode: 'prontera', token: 2 });
		recovery.failed('missing'); await Promise.resolve();
		expect(onRecover).toHaveBeenCalledTimes(1);
		expect(state().onReturn).toBeNull();
		expect(state().onRetry).toBeTypeOf('function');
	});
	it('never offers another safe-point return when Prontera itself times out', async () => {
		recovery.begin({ recoveryMode: 'prontera' });
		await vi.advanceTimersByTimeAsync(30000);
		expect(state().message).toContain('普隆德拉加载超时');
		expect(state().onReturn).toBeNull();
		expect(onRecover).not.toHaveBeenCalled();
	});
	it('retries with the current token and updated context without restarting the original deadline', async () => {
		recovery.begin({ token: 4 });
		await vi.advanceTimersByTimeAsync(20000);
		recovery.updateContext({ recoveryMode: 'prontera' });
		await vi.advanceTimersByTimeAsync(10000);
		expect(state().onReturn).toBeNull();
		state().onRetry(); await Promise.resolve();
		expect(onRetry).toHaveBeenCalledExactlyOnceWith({ token: 4, recoveryMode: 'prontera' });
	});
	it('ignores callbacks and failures from older attempts and cancels pending requests', async () => {
		const old = recovery.begin({ token: 1 });
		recovery.begin({ token: 2 });
		recovery.failed('old', old); recovery.loaded(old);
		expect(onRecover).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(30000);
		expect(state().onReturn).toBeTypeOf('function');
		recovery.failed('new'); recovery.cancel();
		await Promise.resolve();
		expect(onRecover).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
	it('does not spin forever when an accepted recovery never starts another map', async () => {
		recovery.begin({ token: 1 }); recovery.failed('missing');
		recovery.handleResult({ status: 0, destination: 1 });
		expect(state().message).toContain('正在返回普隆德拉');
		await vi.advanceTimersByTimeAsync(10000);
		expect(state().message).toContain('请求超时');
		expect(state().busy).toBe(false);
		expect(onRecover).toHaveBeenCalledTimes(1);
	});
	it.each([1, 2, 3, 4])('stops automatic retry on rejected recovery status %s', async status => {
		recovery.begin({ token: 1 }); recovery.failed('missing');
		await Promise.resolve();
		recovery.handleResult({ status, destination: '' });
		expect(state().busy).toBe(false);
		expect(state().onReturn === null).toBe(status !== 4);
		recovery.failed('duplicate asset failure');
		await vi.advanceTimersByTimeAsync(60000);
		expect(onRecover).toHaveBeenCalledTimes(1);
	});
	it('keeps a previous-location acceptance message for destination zero', () => {
		recovery.begin({ token: 1 }); recovery.failed('missing');
		recovery.handleResult({ status: 0, destination: 0 });
		expect(state().message).toContain('正在返回原位置');
	});
	it('reports request failures and clears loading deadlines on success or exit', async () => {
		onRecover.mockRejectedValue(new Error('offline'));
		recovery.begin({}); recovery.failed('missing');
		await vi.advanceTimersByTimeAsync(0);
		expect(state().message).toContain('无法完成地图恢复');
		state().onExit(); expect(onExit).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
		const id = recovery.begin({}); recovery.loaded(id);
		await vi.advanceTimersByTimeAsync(60000);
		expect(vi.getTimerCount()).toBe(0);
	});
	it('ignores a timed-out request rejection after retrying the same map attempt', async () => {
		let reject;
		onRecover.mockReturnValue(new Promise((_, r) => { reject = r; }));
		recovery.begin({ token: 1 }); recovery.failed('missing');
		await vi.advanceTimersByTimeAsync(10000);
		state().onRetry(); await Promise.resolve();
		expect(onRetry).toHaveBeenCalledOnce();
		reject(new Error('late failure'));
		await vi.advanceTimersByTimeAsync(0);
		expect(state().busy).toBe(true);
		expect(state().message).toContain('正在重试');
		expect(vi.getTimerCount()).toBe(1);
	});
	it('ignores a rejected promise belonging to a replaced loading attempt', async () => {
		let reject;
		onRecover.mockReturnValue(new Promise((_, r) => { reject = r; }));
		recovery.begin({ token: 1 }); recovery.failed('missing'); await Promise.resolve();
		recovery.begin({ token: 2 }); reject(new Error('old request'));
		await vi.advanceTimersByTimeAsync(0);
		expect(view.hide).toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(30000);
		expect(state().message).toContain('超过 30 秒');
	});
});

it('renders an independent accessible overlay with explicit Chinese actions', () => {
	const view = createMapLoadRecoveryView(document), onReturn = vi.fn();
	view.show({ message: '<missing.rsw>', busy: false, onRetry: vi.fn(), onReturn, onExit: vi.fn() });
	const host = document.getElementById('MapLoadRecovery');
	expect(host.getAttribute('role')).toBe('dialog');
	expect(host.style.zIndex).toBe('2147483647');
	expect(host.querySelector('p').textContent).toBe('<missing.rsw>');
	expect([...host.querySelectorAll('button')].map(b => b.textContent)).toEqual(['重试加载', '返回普隆德拉', '退出游戏']);
	host.querySelectorAll('button')[1].click(); expect(onReturn).toHaveBeenCalledOnce();
	view.hide(); expect(document.getElementById('MapLoadRecovery')).toBeNull();
});
