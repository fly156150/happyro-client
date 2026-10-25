/** The reviewed INFO identity includes flags: a monster link is never a map link. */
export function naviTargetKey(info) {
	const parts = String(info ?? '')
		.split(',')
		.map(part => part.trim());
	parts[0] = parts[0].replace(/\.(?:gat|rsw)$/i, '').toLowerCase();
	for (const index of [1, 2]) if (/^\d+$/.test(parts[index] ?? '')) parts[index] = String(Number(parts[index]));
	while (parts.at(-1) === '') parts.pop();
	return parts.join(',');
}

/** Only manifest-approved actions can reach the transport. No network preflight. */
export function createNaviActions({ manifest, prepareTeleport, getState, teleport, present, openMonster, openMap }) {
	let generation = 0;
	let pendingKey = null;
	let pendingRequest = null;
	let refreshWaiting = null;
	function activate(info, label = '') {
		const key = naviTargetKey(info);
		if (pendingKey === key && pendingRequest === generation) return true;
		const request = ++generation;
		refreshWaiting = null;
		const entry = manifest.entries[key];
		const title = label || entry?.mapName || '导航目标';
		const target = entry?.mapName
			? { id: entry.mapName, mapName: entry.mapName, x: entry.x, y: entry.y, name: title }
			: null;
		const isCurrent = () => request === generation;
		const viewMap = target
			? () => {
					if (isCurrent()) openMap(target, isCurrent);
				}
			: undefined;
		const show = (message, retry, kind = 'info') =>
			present({
				title,
				message,
				retry,
				viewMap,
				kind,
				onDismiss: () => {
					if (isCurrent()) generation++;
				}
			});
		if (!entry) {
			show('这个导航目标尚未通过审查，暂时不能传送。');
			return false;
		}
		if (entry.kind === 'blocked') {
			show(entry.message || '这个导航目标暂时不能传送。');
			return false;
		}
		if (entry.kind === 'monster') {
			show('正在打开魔物图鉴。');
			openMonster(entry.monsterId, isCurrent);
			return true;
		}
		if (entry.kind !== 'coordinate') {
			show('导航目标类型无效，暂时不能传送。');
			return false;
		}
		const attempt = () => {
			if (request !== generation) return false;
			const guard = prepareTeleport();
			if (!guard.allowed) {
				show(guard.message || '请先结束当前 NPC 对话，再点击传送。', attempt);
				return false;
			}
			const state = getState(entry);
			if (!state.canTeleport) {
				const message = !state.connectionReady
					? '游戏连接尚未就绪，请重新进入游戏后再试。'
					: !state.allowed
						? '当前角色没有传送权限'
						: !state.supportedMap
							? '当前客户端不支持目标地图'
							: state.dead
								? '角色已倒下，请先返回保存点。'
								: state.loading
									? '地图正在加载，请等待加载完成。'
									: state.mapPending || state.npcPending
										? '已有传送请求尚未确认，请先确认结果。'
										: state.cooldownRemaining > 0
											? `传送冷却中，请等待 ${state.cooldownRemaining} 秒`
											: '跨地图传送已关闭';
				show(message, attempt);
				if (state.mapPending)
					refreshWaiting = receipt => {
						if (!isCurrent()) return;
						const latest = getState(entry);
						show(
							latest.mapPending || receipt.result < 0
								? '上一笔传送结果尚未确认，请先核对角色位置。'
								: '上一笔传送请求已结束，可以点击传送前往此目标。',
							latest.mapPending || receipt.result < 0 ? undefined : attempt
						);
					};
				return false;
			}
			show('正在等待服务器确认传送结果。');
			pendingKey = key;
			pendingRequest = request;
			const sent = teleport(
				entry,
				result => {
					if (pendingRequest === request) {
						pendingKey = null;
						pendingRequest = null;
					}
					if (request !== generation) {
						refreshWaiting?.(result);
						return;
					}
					if (result.result === 0) show('已传送到目标附近。', undefined, 'success');
					else if (result.result < 0)
						show(result.message || '传送结果尚未确认，请先核对角色位置；不会自动重试。');
					else show(getState(entry).message || '服务器拒绝了本次传送，角色未传送到目标。', attempt, 'error');
				},
				progress => {
					if (request === generation) show(progress.message);
				}
			);
			if (!sent) {
				pendingKey = null;
				pendingRequest = null;
				show('本次未发送传送请求，请稍后再试。', attempt);
			}
			return sent;
		};
		return attempt();
	}
	return {
		activate,
		reset() {
			generation++;
			pendingKey = null;
			pendingRequest = null;
			refreshWaiting = null;
		}
	};
}
