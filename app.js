const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const stage = document.querySelector('.stage-wrap');
const emptyState = document.getElementById('emptyState');
const editControls = document.getElementById('editControls');
const zoomSlider = document.getElementById('zoom');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn');
const shareBtn = document.getElementById('shareBtn');
const toast = document.getElementById('toast');

const W = canvas.width;
const H = canvas.height;
const frame = new Image();
frame.src = 'frame.png';
frame.decoding = 'async';

let photo = null;
let baseScale = 1;
let zoom = 1;
let x = W / 2;
let y = H / 2;
let pointers = new Map();
let lastPinchDistance = null;
let lastPinchCenter = null;

frame.onload = draw;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove('show'), 2200);
}

function fitCover() {
  if (!photo) return;
  baseScale = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
  zoom = 1;
  x = W / 2;
  y = H / 2;
  zoomSlider.value = 1;
  clampPosition();
}

function currentSize() {
  if (!photo) return { w: 0, h: 0 };
  const s = baseScale * zoom;
  return { w: photo.naturalWidth * s, h: photo.naturalHeight * s };
}

function clampPosition() {
  if (!photo) return;
  const { w, h } = currentSize();
  const minX = W - w / 2;
  const maxX = w / 2;
  const minY = H - h / 2;
  const maxY = h / 2;
  x = Math.min(maxX, Math.max(minX, x));
  y = Math.min(maxY, Math.max(minY, y));
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (photo) {
    const { w, h } = currentSize();
    ctx.drawImage(photo, x - w / 2, y - h / 2, w, h);
  }
  if (frame.complete && frame.naturalWidth) {
    ctx.drawImage(frame, 0, 0, W, H);
  }
}

function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file.');
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    photo = img;
    fitCover();
    emptyState.hidden = true;
    editControls.hidden = false;
    draw();
    URL.revokeObjectURL(objectUrl);
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    showToast('This image could not be opened.');
  };
  img.src = objectUrl;
}

cameraInput.addEventListener('change', e => loadFile(e.target.files[0]));
galleryInput.addEventListener('change', e => loadFile(e.target.files[0]));

zoomSlider.addEventListener('input', () => {
  zoom = Number(zoomSlider.value);
  clampPosition();
  draw();
});

resetBtn.addEventListener('click', () => {
  if (!photo) return;
  fitCover();
  draw();
});

function pointToCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top) * (H / r.height)
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

stage.addEventListener('pointerdown', e => {
  if (!photo) return;
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, pointToCanvas(e.clientX, e.clientY));
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    lastPinchDistance = distance(a, b);
    lastPinchCenter = midpoint(a, b);
  }
});

stage.addEventListener('pointermove', e => {
  if (!photo || !pointers.has(e.pointerId)) return;
  const oldPoint = pointers.get(e.pointerId);
  const newPoint = pointToCanvas(e.clientX, e.clientY);
  pointers.set(e.pointerId, newPoint);

  if (pointers.size === 1) {
    x += newPoint.x - oldPoint.x;
    y += newPoint.y - oldPoint.y;
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const newDistance = distance(a, b);
    const newCenter = midpoint(a, b);
    if (lastPinchDistance && lastPinchCenter) {
      const factor = newDistance / lastPinchDistance;
      const oldZoom = zoom;
      zoom = Math.min(4, Math.max(1, zoom * factor));

      // Keep the area under the pinch center visually stable while zooming.
      const ratio = zoom / oldZoom;
      x = newCenter.x - (newCenter.x - x) * ratio;
      y = newCenter.y - (newCenter.y - y) * ratio;
      x += newCenter.x - lastPinchCenter.x;
      y += newCenter.y - lastPinchCenter.y;
      zoomSlider.value = zoom;
    }
    lastPinchDistance = newDistance;
    lastPinchCenter = newCenter;
  }
  clampPosition();
  draw();
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) {
    lastPinchDistance = null;
    lastPinchCenter = null;
  }
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

stage.addEventListener('wheel', e => {
  if (!photo) return;
  e.preventDefault();
  const p = pointToCanvas(e.clientX, e.clientY);
  const oldZoom = zoom;
  zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
  const ratio = zoom / oldZoom;
  x = p.x - (p.x - x) * ratio;
  y = p.y - (p.y - y) * ratio;
  zoomSlider.value = zoom;
  clampPosition();
  draw();
}, { passive: false });

function canvasBlob() {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
}

saveBtn.addEventListener('click', async () => {
  if (!photo) return;
  const blob = await canvasBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ENOughforSebastian-story.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast('Photo prepared. If iPhone opens it, use Share → Save Image.');
});

shareBtn.addEventListener('click', async () => {
  if (!photo) return;
  const blob = await canvasBlob();
  const file = new File([blob], 'ENOughforSebastian-story.png', { type: 'image/png' });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: '#ENOughforSebastian',
        text: '#ENOughforSebastian'
      });
    } else if (navigator.share) {
      await navigator.share({ title: '#ENOughforSebastian', text: '#ENOughforSebastian' });
      showToast('Your browser cannot attach the image automatically. Save it first, then post it.');
    } else {
      showToast('Sharing is not supported here. Use Save Photo instead.');
    }
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Could not open the share sheet. Try Save Photo.');
  }
});

draw();
