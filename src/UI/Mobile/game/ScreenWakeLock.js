/** Keep the visible game awake; the browser retains control over power policy. */
export function createScreenWakeLock() {
	let disposed = false;
	let pending = false;
	let lock = null;
	async function release() {
		const previous = lock;
		lock = null;
		if (previous && !previous.released) {
			try {
				await previous.release();
			} catch {
				// The browser may already have revoked the lock.
			}
		}
	}
	async function acquire() {
		if (disposed || document.hidden || pending || (lock && !lock.released) || !navigator.wakeLock) return;
		pending = true;
		try {
			const requested = await navigator.wakeLock.request('screen');
			if (disposed || document.hidden) {
				await requested.release();
				return;
			}
			lock = requested;
			requested.addEventListener(
				'release',
				() => {
					if (lock === requested) lock = null;
				},
				{ once: true }
			);
		} catch {
			// Unsupported contexts and system power restrictions must not interrupt play.
		} finally {
			pending = false;
		}
	}
	function visibilityChanged() {
		if (document.hidden) void release();
		else void acquire();
	}
	document.addEventListener('visibilitychange', visibilityChanged);
	void acquire();
	return () => {
		disposed = true;
		document.removeEventListener('visibilitychange', visibilityChanged);
		void release();
	};
}
