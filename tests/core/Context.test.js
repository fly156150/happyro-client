import { afterEach, expect, it, vi } from 'vitest';
import Context from '../../src/Core/Context.js';

afterEach(() => vi.unstubAllGlobals());

it('exits fullscreen with the standard API when no legacy API exists', async () => {
 const exitFullscreen = vi.fn().mockResolvedValue(undefined);
 vi.stubGlobal('document', { exitFullscreen });
 await Context.cancelFullScreen();
 expect(exitFullscreen).toHaveBeenCalledOnce();
});

it('prefers the standard API when a legacy API also exists', async () => {
 const exitFullscreen = vi.fn().mockResolvedValue(undefined);
 const webkitCancelFullScreen = vi.fn();
 vi.stubGlobal('document', { exitFullscreen, webkitCancelFullScreen });
 await Context.cancelFullScreen();
 expect(exitFullscreen).toHaveBeenCalledOnce();
 expect(webkitCancelFullScreen).not.toHaveBeenCalled();
});
