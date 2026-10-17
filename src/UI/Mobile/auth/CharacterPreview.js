import SpriteRenderer from 'Renderer/SpriteRenderer.js';

// Keep ordinary characters at their existing size; fit tall/wide silhouettes only.
export function fitCharacterPreview(bounds, width, height, preferredScale) {
 const baseline = height - 24;
 const scale = Math.min(preferredScale, (width - 16) / bounds.width, (baseline - 12) / bounds.height);
 return { scale, x: (width - bounds.width * scale) / 2, y: baseline - bounds.height * scale };
}

export function createCharacterPreviewRenderer() {
 const states = new WeakMap();
 return (entity, target) => {
  let state = states.get(target.canvas);
  if (!state) {
   const canvas = document.createElement('canvas');
   canvas.width = canvas.height = 512;
   state = { canvas, context: canvas.getContext('2d', { willReadFrequently: true }), signature: '', bounds: null };
   states.set(target.canvas, state);
  }
  const { canvas, context } = state;
  context.clearRect(0, 0, canvas.width, canvas.height);
  SpriteRenderer.bind2DContext(context, 256, 380);
  entity.renderEntity();
  const signature = JSON.stringify([entity.renderJob, entity.sex, entity.action, entity.direction, entity.files]);
  if (signature !== state.signature || !state.bounds) {
   const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
   let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
   for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
     if (pixels[(y * canvas.width + x) * 4 + 3]) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
     }
    }
   }
   state.signature = signature;
   // Extra room for idle-animation movement; bounds are scanned on resource changes, not each frame.
   state.bounds = right < 0 ? null : { x: left - 8, y: top - 8, width: right - left + 17, height: bottom - top + 17 };
  }
  if (!state.bounds) return;
  const bounds = state.bounds;
  const preferredScale = Number(getComputedStyle(target.canvas).getPropertyValue('--character-preview-scale')) || 1;
  const fit = fitCharacterPreview(bounds, target.canvas.width, target.canvas.height, preferredScale);
  target.imageSmoothingEnabled = false;
  target.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height,
   fit.x, fit.y, bounds.width * fit.scale, bounds.height * fit.scale);
 };
}
