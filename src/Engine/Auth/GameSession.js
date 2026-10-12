// The page-only credential stays in this module. Persistent credentials live in
// HttpOnly cookies and are never copied into localStorage/sessionStorage.
export function createGameSession(fetchRequest = (...args) => fetch(...args)) {
	let token;
	let available = false;
	let queue = Promise.resolve();
	function enqueue(operation) {
		const result = queue.then(operation);
		queue = result.catch(() => {});
		return result;
	}
	async function request(operation, body = {}) {
		const response = await fetchRequest(`/api/game-session/${operation}`, {
			method: 'POST',
			credentials: 'same-origin',
			cache: 'no-store',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...body, ...(token ? { token } : {}) }),
			signal: AbortSignal.timeout(7000)
		});
		if (response.status === 401) {
			available = false;
			token = undefined;
			return null;
		}
		if (!response.ok) throw new Error('登录会话服务暂时不可用');
		if (response.status === 204) return null;
		const result = await response.json();
		token = result.token;
		available = true;
		return result;
	}
	return {
		get available() {
			return available;
		},
		create: (accountId, webToken, persistent) =>
			enqueue(() => request('create', { accountId, webToken, persistent })),
		resume: () => enqueue(() => request('resume')),
		revoke: () => {
			available = false;
			return enqueue(async () => {
				await request('revoke');
				token = undefined;
				available = false;
			});
		}
	};
}
export default createGameSession();
