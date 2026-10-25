/* eslint-disable */
import fs from 'fs';
import { verifyNaviReview } from '../../scripts/verify-navi-review.mjs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));

const startTime = Date.now();
const args = getArgs();

const buildDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
const buildId = startTime.toString(36);
const dist = './dist/';
const platform = 'Web';

// Aliases (same as vite.config.js)
const aliases = {
	App: path.resolve(__dirname, '../../src/App'),
	Audio: path.resolve(__dirname, '../../src/Audio'),
	Controls: path.resolve(__dirname, '../../src/Controls'),
	Core: path.resolve(__dirname, '../../src/Core'),
	DB: path.resolve(__dirname, '../../src/DB'),
	Engine: path.resolve(__dirname, '../../src/Engine'),
	Loaders: path.resolve(__dirname, '../../src/Loaders'),
	Network: path.resolve(__dirname, '../../src/Network'),
	Plugins: path.resolve(__dirname, '../../src/Plugins'),
	Preferences: path.resolve(__dirname, '../../src/Preferences'),
	Renderer: path.resolve(__dirname, '../../src/Renderer'),
	UI: path.resolve(__dirname, '../../src/UI'),
	Utils: path.resolve(__dirname, '../../src/Utils'),
	Vendors: path.resolve(__dirname, '../../src/Vendors')
};

const header = [
	'/*',
	' * Build with RONW Builder [MrUnzO] (https://github.com/MrUnzO/RONW)',
	' * ',
	' * This file is part of ROBrowser, (http://www.robrowser.com/).',
	' * @author Vincent Thibault and the community',
	' */\n'
].join('\n');

// Map appName to entry file path (relative to project root)
const entryMap = {
	ThreadEventHandler: 'src/Core/ThreadEventHandler.js',
	GrannyModelViewer: 'src/App/GrannyModelViewer.js',
	GrfViewer: 'src/App/GrfViewer.js',
	MapViewer: 'src/App/MapViewer.js',
	ModelViewer: 'src/App/ModelViewer.js',
	Online: 'src/App/Online.js',
	StrViewer: 'src/App/StrViewer.js',
	EffectViewer: 'src/App/EffectViewer.js'
};

(async function build() {
	verifyNaviReview();
	const basePath = dist + platform;

	const modules = {
		G: { path: '/GrannyModelViewer.js', action: () => compile('GrannyModelViewer', args['m']) },
		D: { path: '/GrfViewer.js', action: () => compile('GrfViewer', args['m']) },
		V: { path: '/MapViewer.js', action: () => compile('MapViewer', args['m']) },
		M: { path: '/ModelViewer.js', action: () => compile('ModelViewer', args['m']) },
		O: { path: '/Online.js', action: () => compile('Online', args['m']) },
		S: { path: '/StrViewer.js', action: () => compile('StrViewer', args['m']) },
		E: { path: '/EffectViewer.js', action: () => compile('EffectViewer', args['m']) },
		T: { path: '/ThreadEventHandler.js', action: () => compile('ThreadEventHandler', args['m']) },
		H: { path: '/index.html', action: () => createHTML(false, args, isAll) },
		PWA: {
			path: '/index.html',
			action: async () => {
				createHTML(true, args, isAll);
				await copyPwaFiles();
			}
		}
	};

	// Ensure base directories exist
	if (!fs.existsSync(dist)) {
		fs.mkdirSync(dist);
	}
	if (!fs.existsSync(basePath)) {
		fs.mkdirSync(basePath);
	}

	// Filter and process only necessary modules
	const isAll = args['all'] || Object.keys(args).length === 0;
	const activeModules = Object.keys(modules).filter(key => isAll || args[key]);

	for (const key of activeModules) {
		const { path: modPath, action } = modules[key];
		const fullPath = `${basePath}${modPath}`;
		if (fs.existsSync(fullPath)) {
			fs.rmSync(fullPath, { recursive: true, force: true });
		}
		await action();
	}

	writeBuildInfo();
})();

async function compile(appName, isMinify) {
	console.log(appName + '.js', '- Compiling...', '[ Minify:', isMinify ? 'true' : 'false', ']');

	const { build } = await import('vite');
	const projectRoot = path.resolve(__dirname, '../../');
	const entry = path.resolve(projectRoot, entryMap[appName]);
	const outDir = path.resolve(projectRoot, dist + platform);

	try {
		await build({
			configFile: false,
			root: projectRoot,
			base: './',
			logLevel: 'warn',
			resolve: {
				alias: aliases
			},
			worker: {
				rollupOptions: {
					output: {
						entryFileNames: '[name].js'
					}
				}
			},
			build: {
				outDir: outDir,
				emptyOutDir: false,
				assetsInlineLimit: 1024 * 1024,
				rollupOptions: {
					input: entry,
					output: {
						format: 'es',
						entryFileNames: appName + '.js', //Online -> Online.js
						codeSplitting: false,
						banner: header
					},
					onwarn(warning, warn) {
						if (warning.code === 'PLUGIN_TIMINGS') {
							// just appears if vite spending much time to compile css and assets
							return;
						}
						warn(warning);
					}
				},
				minify: isMinify ? 'terser' : false,
				terserOptions: isMinify
					? {
							format: {
								ascii_only: true,
								comments: false
							}
						}
					: undefined,
				// Don't copy public assets for each module build
				copyPublicDir: false
			}
		});

		console.log(appName + '.js has been created in', Date.now() - startTime, 'ms.');
	} catch (err) {
		console.error('Error building ' + appName + ':', err);
		throw err;
	}
}

function createHTML(includeManifest = false, buildArgs = {}, isAllBuild = false) {
	const start = Date.now();
	const manifest = includeManifest ? `<link rel="manifest" href="./manifest.webmanifest">` : ``;

	const appButtonMap = [
		{ flag: 'O', app: 'ONLINE', label: '进入游戏' },
		{ flag: 'G', app: 'GRANNYMODELVIEWER', label: 'Granny 模型查看器' },
		{ flag: 'D', app: 'GRFVIEWER', label: 'GRF 资源查看器' },
		{ flag: 'V', app: 'MAPVIEWER', label: '地图查看器' },
		{ flag: 'M', app: 'MODELVIEWER', label: '模型查看器' },
		{ flag: 'S', app: 'STRVIEWER', label: 'STR 动画查看器' },
		{ flag: 'E', app: 'EFFECTVIEWER', label: '特效查看器' }
	];

	const viewerFlags = appButtonMap.filter(v => v.flag !== 'O').map(v => v.flag);
	const hasViewerFlags = isAllBuild || viewerFlags.some(flag => buildArgs[flag]);

	const commonHead = `<!DOCTYPE html>    
<html>    
    <head>    
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>    
        <meta charset="UTF-8">    
        <meta name="happyro-build-id" content="${buildId}">
        <title>HappyRO</title>    
        <link rel="icon" type="image/png" href="./favicon.png?v=happyro-icon-2">    
    
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">    
        <meta name="HandheldFriendly" content="true">    
    
        <meta name="apple-mobile-web-app-capable" content="yes">    
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">    
        <meta name="apple-mobile-web-app-title" content="HappyRO">    
        <meta name="mobile-web-app-capable" content="yes">    
    
        <meta name="description" content="HappyRO">    
        <meta name="keywords" content="HappyRO">    
        <meta name="author" content="HappyRO">    
        <meta name="robots" content="index">    
    
        <meta name="theme-color" content="#ff8cb5">    
    
        <meta property="og:title" content="HappyRO">    
        <meta property="og:description" content="HappyRO">    
        <meta property="og:type" content="website">    
        <meta property="og:locale" content="en_US">    
    
        <link rel="apple-touch-icon" href="./icon.png">    
        ${manifest}`;

	let body;

	if (hasViewerFlags) {
		const activeViewers = appButtonMap.filter(v => isAllBuild || buildArgs[v.flag]);
		const buttons = activeViewers
			.map(v => `                <button class="app-btn" onclick="launchApp('${v.app}')">${v.label}</button>`)
			.join('\n');

		createApiHTML();

		body = `${commonHead}    
  
        <style>    
            html, body {    
                margin: 0; padding: 0; border: 0;    
                height: 100%; width: 100%; overflow: hidden;    
            }    
            #ro-preloader {    
                position: fixed;    
                top: 0; left: 0;    
                width: 100%; height: 100%;    
                z-index: 99999;    
                background: rgba(6, 8, 16, 0.97);    
                display: flex;    
                align-items: center;    
                justify-content: center;    
                flex-direction: column;    
            }    
            #ro-preloader .pre-spinner {    
                width: 48px; height: 48px;    
                margin: 0 auto 16px;    
                border: 4px solid rgba(232, 184, 75, 0.2);    
                border-top-color: #e8b84b;    
                border-radius: 50%;    
                animation: ro-pre-spin 0.8s linear infinite;    
            }    
            #ro-preloader .pre-text {    
                font-family: serif;    
                font-size: 16px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                color: #e8b84b;    
            }    
            #ro-preloader .pre-text span {    
                display: inline-block;    
                animation: ro-pre-wave 1.2s ease-in-out infinite;    
                animation-delay: calc(var(--i) * 0.08s);    
            }    
            @keyframes ro-pre-spin {    
                to { transform: rotate(360deg); }    
            }    
            @keyframes ro-pre-wave {    
                0%, 60%, 100% { transform: translateY(0); }    
                30% { transform: translateY(-8px); }    
            }    
            #ro-preloader.fade-out {    
                opacity: 0;    
                transition: opacity 0.3s ease;    
            }    
            .app-launcher {    
                display: flex;    
                flex-direction: column;    
                align-items: center;    
                justify-content: safe center;
                box-sizing: border-box;
                height: 100dvh;
                overflow: auto;
                padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
                background: rgba(6, 8, 16, 0.97);    
                font-family: serif;    
                color: #e8b84b;    
            }    
            .app-launcher h1 {    
                font-size: 28px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                margin-bottom: 32px;    
            }    
            .button-grid {    
                display: flex;    
                flex-wrap: wrap;    
                gap: 16px;    
                justify-content: center;    
                max-width: 600px;    
            }    
            .app-btn {    
                padding: 14px 28px;    
                font-family: serif;    
                font-size: 16px;    
                letter-spacing: 2px;    
                color: #e8b84b;    
                background: transparent;    
                border: 2px solid rgba(232, 184, 75, 0.4);    
                border-radius: 8px;    
                cursor: pointer;    
                transition: all 0.3s ease;    
            }    
            .app-btn:hover {    
                background: rgba(232, 184, 75, 0.15);    
                border-color: #e8b84b;    
            }    
            @media (orientation: portrait) and (max-width: 600px) {
                .app-launcher {
                    justify-content: flex-start;
                    padding: max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(44px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
                }
                .app-launcher h1 {
                    flex-shrink: 0;
                    margin: auto 0 20px;
                    font: 600 21px/1.3 system-ui, sans-serif;
                    letter-spacing: 0;
                    text-align: center;
                }
                .button-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    width: min(100%, 360px);
                    gap: 10px;
                    flex-shrink: 0;
                    margin-bottom: auto;
                }
                .app-btn {
                    width: 100%;
                    min-height: 46px;
                    padding: 10px 16px;
                    font: 600 15px/1.2 system-ui, sans-serif;
                    letter-spacing: 0;
                }
            }
            .build-id { position: fixed; right: max(16px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); color: #8b8f98; font: 12px monospace; }
        </style>    
    </head>    
    <body>    
        <div class="app-launcher">    
            <h1>roBrowser 应用启动器</h1>
            <div class="button-grid">    
${buttons}    
            </div>    
            <div class="build-id">Build: ${buildId}</div>
        </div>    
  
        <script type="text/javascript">    
            function launchApp(appName) {    
                var url = 'api.html?v=${buildId}&app=' + appName + (new URLSearchParams(location.search).get('debug') === '1' ? '&debug=1' : '');
                // Keep touch devices and installed apps in their existing app window.
                if (window.matchMedia('(pointer: coarse), (display-mode: standalone), (display-mode: fullscreen)').matches) {
                    window.location.assign(url);
                    return;
                }
                var w = 1024, h = 768;
                var top = (screen.height - h) / 2;    
                var left = (screen.width - w) / 2;    
                window.open(    
                    url,
                    '_blank',    
                    'width=' + w + ',height=' + h + ',top=' + top + ',left=' + left + ',menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=0'    
                );    
            }    
        </script>    
    </body>    
</html>    
`;
	} else {
		body = `${commonHead}    
  
        <style>    
            html, body {    
                margin: 0; padding: 0; border: 0;    
                height: 100%; width: 100%; overflow: hidden;    
            }    
            #ro-preloader {    
                position: fixed;    
                top: 0; left: 0;    
                width: 100%; height: 100%;    
                z-index: 99999;    
                background: rgba(6, 8, 16, 0.97);    
                display: flex;    
                align-items: center;    
                justify-content: center;    
                flex-direction: column;    
            }    
            #ro-preloader .pre-spinner {    
                width: 48px; height: 48px;    
                margin: 0 auto 16px;    
                border: 4px solid rgba(232, 184, 75, 0.2);    
                border-top-color: #e8b84b;    
                border-radius: 50%;    
                animation: ro-pre-spin 0.8s linear infinite;    
            }    
            #ro-preloader .pre-text {    
                font-family: serif;    
                font-size: 16px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                color: #e8b84b;    
            }    
            #ro-preloader .pre-text span {    
                display: inline-block;    
                animation: ro-pre-wave 1.2s ease-in-out infinite;    
                animation-delay: calc(var(--i) * 0.08s);    
            }    
            @keyframes ro-pre-spin {    
                to { transform: rotate(360deg); }    
            }    
            @keyframes ro-pre-wave {    
                0%, 60%, 100% { transform: translateY(0); }    
                30% { transform: translateY(-8px); }    
            }    
            #ro-preloader.fade-out {    
                opacity: 0;    
                transition: opacity 0.3s ease;    
            }    
        </style>    
    </head>    
    <body>    
        <div id="ro-preloader">    
            <div class="pre-spinner"></div>    
            <p class="pre-text">    
                <span style="--i:0">L</span><span style="--i:1">o</span><span style="--i:2">a</span><span style="--i:3">d</span><span style="--i:4">i</span><span style="--i:5">n</span><span style="--i:6">g</span><span style="--i:7">.</span><span style="--i:8">.</span><span style="--i:9">.</span>    
            </p>    
        </div>    
  
        <script src="Config.js?v=${buildId}"></script>
        <script src="Config.runtime.js?v=${buildId}"></script>
        <script src="Config.happyro.js?v=${buildId}"></script>
        <script>    
            function deepMerge(target, source) {    
                for (var key in source) {    
                    if (source.hasOwnProperty(key)) {    
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {    
                            target[key] = deepMerge(target[key] || {}, source[key]);    
                        } else {    
                            target[key] = source[key];    
                        }    
                    }    
                }    
                return target;    
            }    
    
            window.addEventListener("load", (event) => {    
                // Merge defaults, required HappyRO settings, then optional local overrides.
                var config = deepMerge({}, window.ROConfigBase || {});    
                config = deepMerge(config, window.ROConfigHappyRO || {});
                if (window.ROConfigLocal) {    
                    config = deepMerge(config, window.ROConfigLocal);    
                }    
                window.ROConfig = config;    
    
				var script = document.createElement('script');    
				script.type = 'module';    
				script.src = 'Online.js?v=${buildId}';
				document.getElementsByTagName('body')[0].appendChild(script);  
            });    
        </script>    
    </body>    
</html>    
`;
	}

	fs.writeFileSync(dist + platform + '/index.html', body, { encoding: 'utf8' });
	createConfigJS();
	console.log('index.html has been created in', Date.now() - start, 'ms.');
}

function createConfigJS() {
	const configContent = `/**  
 * ROBrowser Configuration - Default Settings  
 *  
 * This file contains default configuration values.  
 * To override settings without modifying this file, create Config.local.js  
 * with your custom values in window.ROConfigLocal.  
 *  
 * Example Config.local.js:  
 *   window.ROConfigLocal = {  
 *       servers: [{ display: 'My Server', address: '192.168.1.1', ... }],  
 *       skipIntro: true  
 *   };  
 */  
window.ROConfigBase = {  
    development: false,  
    remoteClient: 'https://grf.robrowser.com/',  
    servers: [{  
        display: 'roBrowser Demo Server',  
        desc: 'roBrowser demo server',  
        address: '127.0.0.1',  
        port: 6900,  
        version: 55,  
        langtype: 1,  
        packetver: 20130618,  
        renewal: false,  
        worldMapSettings: { episode: 12 },  
        packetKeys: false,  
        socketProxy: 'wss://connect.robrowser.com',  
        adminList: [2000000]  
    }],
    packetDump: false,  
    skipServerList: true,  
    skipIntro: false,  
    aura: {},  
    autoLogin: [],  
    BGMFileExtension: ['mp3'],  
    calculateHash: false,  
    CameraMaxZoomOut: 5,  
    charBlockSize: 0,  
    clientHash: null,  
    clientVersionMode: "PacketVer",  
    disableConsole: false,  
	enableAchievements: true,
    enableBank: true,  
    enableCashShop: true,  
    enableCheckAttendance: true,  
    enableDmgSuffix: true,  
    enableHomunAutoFeed: true,  
    enableMapName: true,  
    enableRoulette: false,  
    FirstPersonCamera: false,  
    grfList: null,  
    hashFiles: [],  
    loadLua: false,  
    customItemInfo: [],  
    onReady: null,  
    plugins: {},  
    registrationweb: '',  
    saveFiles: true,  
    ThirdPersonCamera: false,  
    transitionDuration: 500,  
    restoreChatFocus: false
};  
`;
	fs.writeFileSync(dist + platform + '/Config.js', configContent, { encoding: 'utf8' });
	fs.copyFileSync('./applications/pwa/Config.runtime.js', dist + platform + '/Config.runtime.js');
	fs.copyFileSync('./src/Core/ClientDefaults.schema.json', dist + platform + '/client-defaults.schema.json');
	fs.copyFileSync('./applications/pwa/Config.happyro.js', dist + platform + '/Config.happyro.js');
}

function createApiHTML() {
	const apiHtml = `<!DOCTYPE html>    
<html>    
    <head>    
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
        <meta charset="UTF-8">    
        <meta name="happyro-build-id" content="${buildId}">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <title>HappyRO</title>    
        <link rel="icon" type="image/png" href="./favicon.png?v=happyro-icon-2">    
        <link rel="apple-touch-icon" href="./icon.png">    
        <style>    
            html, body {    
                margin: 0; padding: 0; border: 0;    
                height: 100%; width: 100%; overflow: hidden;    
            }    
            #ro-preloader {    
                position: fixed;    
                top: 0; left: 0;    
                width: 100%; height: 100%;    
                z-index: 99999;    
                background: rgba(6, 8, 16, 0.97);    
                display: flex;    
                align-items: center;    
                justify-content: center;    
                flex-direction: column;    
                gap: 18px;    
            }    
            .pre-spinner {    
                width: 48px; height: 48px;    
                border: 4px solid rgba(232, 184, 75, 0.2);    
                border-top-color: #e8b84b;    
                border-radius: 50%;    
                animation: ro-spin 0.8s linear infinite;    
            }    
            @keyframes ro-spin {    
                to { transform: rotate(360deg); }    
            }    
            .pre-text {    
                font-family: 'Cinzel', serif;    
                font-size: 16px;    
                letter-spacing: 3px;    
                text-transform: uppercase;    
                color: #e8b84b;    
                display: flex;    
                gap: 2px;    
            }    
            .pre-text span {    
                animation: ro-wave 1.2s ease-in-out infinite;    
                animation-delay: calc(var(--i) * 0.08s);    
            }    
            @keyframes ro-wave {    
                0%, 100% { opacity: 0.4; transform: translateY(0); }    
                50% { opacity: 1; transform: translateY(-4px); }    
            }    
            #ro-preloader .pre-poring { display: none; }
            @media (pointer: coarse) {
                #ro-preloader { box-sizing: border-box; background: #f8f9fb; gap: 16px; padding: 24px; text-align: center; }
                #ro-preloader .pre-poring { display: block; width: min(80px, 18vh); height: auto; aspect-ratio: 1; object-fit: contain; image-rendering: pixelated; }
                #ro-preloader .pre-spinner { width: 32px; height: 32px; border: 3px solid #e2e5e9; border-top-color: #b44800; }
                #ro-preloader .pre-text { display: none; }
                #ro-preloader::after { content: '正在启动…'; color: #34383d; font: 16px/1.5 system-ui, sans-serif; }
            }
            @media (pointer: coarse) and (prefers-reduced-motion: reduce) {
                #ro-preloader .pre-spinner { animation: none; }
            }
        </style>    
        <script src="debug.js?v=${buildId}"></script>
        <script src="api.js?v=${buildId}"></script>
    </head>    
    <body>    
        <div id="ro-preloader">    
            <img class="pre-poring" src="./ro-poring-1.webp" alt="">
            <div class="pre-spinner"></div>    
            <p class="pre-text">    
                <span style="--i:0">L</span><span style="--i:1">o</span><span style="--i:2">a</span><span style="--i:3">d</span><span style="--i:4">i</span><span style="--i:5">n</span><span style="--i:6">g</span><span style="--i:7">.</span><span style="--i:8">.</span><span style="--i:9">.</span>    
            </p>    
        </div>    
    
        <script src="Config.js?v=${buildId}"></script>
        <script src="Config.runtime.js?v=${buildId}"></script>
        <script src="Config.happyro.js?v=${buildId}"></script>
        <script>    
            function deepMerge(target, source) {    
                for (var key in source) {    
                    if (source.hasOwnProperty(key)) {    
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {    
                            target[key] = deepMerge(target[key] || {}, source[key]);    
                        } else {    
                            target[key] = source[key];    
                        }    
                    }    
                }    
                return target;    
            }    
    
            var APP_SCRIPTS = {    
                ONLINE: 'Online.js',    
                MAPVIEWER: 'MapViewer.js',    
                GRFVIEWER: 'GrfViewer.js',    
                MODELVIEWER: 'ModelViewer.js',    
                STRVIEWER: 'StrViewer.js',    
                GRANNYMODELVIEWER: 'GrannyModelViewer.js',    
                EFFECTVIEWER: 'EffectViewer.js'    
            };    
            var APP_IDS = { 1: 'ONLINE', 2: 'MAPVIEWER', 3: 'GRFVIEWER', 4: 'MODELVIEWER', 5: 'STRVIEWER', 6: 'GRANNYMODELVIEWER', 7: 'EFFECTVIEWER' };    
    
            function loadApp(appName, extraConfig) {    
                var scriptFile = APP_SCRIPTS[appName] || 'Online.js';    
                var config = deepMerge({}, window.ROConfigBase || {});    
                config = deepMerge(config, window.ROConfigHappyRO || {});
                if (window.ROConfigLocal) { config = deepMerge(config, window.ROConfigLocal); }    
                if (extraConfig) { config = deepMerge(config, extraConfig); }    
                window.ROConfig = config;    
                import('./' + scriptFile + '?v=${buildId}').then(function() {
                    var preloader = document.getElementById('ro-preloader');    
                    if (preloader) { preloader.remove(); }    
                }).catch(function(err) { console.error('Failed to load app:', scriptFile, err); });    
            }    
    
            window.addEventListener('load', function() {    
                var params = new URLSearchParams(window.location.search);    
                var appName = params.get('app');    
                if (appName) {    
                    loadApp(appName, null);    
                } else {    
                    window.addEventListener('message', function onMsg(event) {    
                        if (!event.data || typeof event.data !== 'object') return;    
                        if (!event.data.application) return;    
                        window.removeEventListener('message', onMsg, false);    
                        var name = APP_IDS[event.data.application] || 'ONLINE';    
                        loadApp(name, event.data);    
                        if (event.source) { event.source.postMessage('ready', '*'); }    
                    }, false);    
                }    
            });    
        </script>    
    </body>    
</html>    
`;
	fs.writeFileSync(dist + platform + '/api.html', apiHtml, { encoding: 'utf8' });
	fs.copyFileSync('./applications/api/api.js', dist + platform + '/api.js');
	fs.copyFileSync('./applications/api/debug.js', dist + platform + '/debug.js');
	fs.copyFileSync('./applications/api/debug-upload.js', dist + platform + '/debug-upload.js');
}

function writeBuildInfo() {
	const outputRoot = path.resolve(dist + platform);
	const artifactNames = [
		'index.html',
		'api.html',
		'api.js',
		'debug.js',
		'debug-upload.js',
		'Online.js',
		'Config.js',
		'Config.happyro.js',
		'client-defaults.schema.json',
		'data/navigation/catalog.json',
		'data/navigation/graph.json',
		'data/monsters/catalog.json',
		'data/world/npc-assets.json'
	];
	const artifacts = {};
	for (const name of artifactNames) {
		const file = path.join(outputRoot, name);
		if (fs.existsSync(file)) {
			artifacts[name] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
		}
	}
	fs.writeFileSync(
		path.join(outputRoot, 'build-info.json'),
		JSON.stringify({ buildId, builtAt: new Date(startTime).toISOString(), artifacts }, null, 2) + '\n',
		{ encoding: 'utf8' }
	);
	console.log('build-info.json has been created for build', buildId);
}

async function copyPwaFiles() {
	const start = Date.now();
	const sharp = (await import('sharp')).default;
	const bgPath = './src/UI/Components/Intro/images/background.jpg';
	fs.copyFileSync('./applications/pwa/favicon.png', dist + platform + '/favicon.png');
	fs.copyFileSync('./applications/pwa/icon.png', dist + platform + '/icon.png');
	fs.copyFileSync('./applications/pwa/icon-512.png', dist + platform + '/icon-512.png');
	fs.copyFileSync('./applications/pwa/ro-poring-1.webp', dist + platform + '/ro-poring-1.webp');
	fs.copyFileSync('./applications/pwa/manifest.webmanifest', dist + platform + '/manifest.webmanifest');
	copyFolder('./applications/pwa/data', dist + platform + '/data');
	await sharp(bgPath)
		.resize(1920, 1080)
		.png()
		.toFile(dist + platform + '/screenshotwide.png');
	await sharp(bgPath)
		.resize(390, 844)
		.png()
		.toFile(dist + platform + '/screenshotnarrow.png');
	console.log('PWA files copied', Date.now() - start, 'ms.');
}

function copyFolder(src, dest) {
	const start = Date.now();
	fs.cpSync(src, dest, { recursive: true });
	console.log(src.replace('./', '') + ' folder and files has been created in', Date.now() - start, 'ms.');
}

function getArgs() {
	const args = {};
	process.argv.slice(2, process.argv.length).forEach(arg => {
		if (arg.slice(0, 2) === '--') {
			const longArg = arg.split('=');
			const longArgFlag = longArg[0].slice(2, longArg[0].length);
			const longArgValue = longArg.length > 1 ? longArg[1] : true;
			args[longArgFlag] = longArgValue;
		} else if (arg[0] === '-') {
			const flags = arg.slice(1, arg.length).split('');
			flags.forEach(flag => {
				args[flag] = true;
			});
		}
	});
	return Object.keys(args).length === 0 ? false : args;
}
