import { WORLD_SIZE } from './generation.js';

const PALETTE = {
  meadow: [118, 131, 74],
  forest: [68, 95, 64],
  marsh: [92, 108, 72],
  ridge: [123, 133, 125],
  crystal: [105, 98, 126],
  coast: [134, 116, 92],
};
const RESOLUTION = 144;
const LOCAL_SPAN = 1050;

export function createWorldMap(canvas, model, onPick) {
  const context = canvas.getContext('2d');
  const base = document.createElement('canvas');
  base.width = base.height = RESOLUTION;
  const baseContext = base.getContext('2d');
  const span = canvas.width;
  let local = false;
  let cacheKey = '';
  let width = WORLD_SIZE;
  let originX = -WORLD_SIZE / 2;
  let originZ = -WORLD_SIZE / 2;

  function xy(x, z) {
    return [(x - originX) / width * span, (z - originZ) / width * span];
  }

  function bake(position) {
    width = local ? LOCAL_SPAN : WORLD_SIZE;
    const half = WORLD_SIZE / 2;
    const clampOrigin = value => Math.max(-half, Math.min(half - width, Math.round((value - width / 2) / 32) * 32));
    originX = local ? clampOrigin(position.x) : -half;
    originZ = local ? clampOrigin(position.z) : -half;
    const key = [width, originX, originZ].join('/');
    if (key === cacheKey) return;
    cacheKey = key;
    const image = baseContext.createImageData(RESOLUTION, RESOLUTION);
    for (let row = 0; row < RESOLUTION; row++) {
      const z = originZ + width * (row + .5) / RESOLUTION;
      for (let col = 0; col < RESOLUTION; col++) {
        const x = originX + width * (col + .5) / RESOLUTION;
        const { height, biome, trail } = model.sampleAt(x, z);
        const index = (row * RESOLUTION + col) * 4;
        const submerged = height < model.waterLevel;
        const contour = !submerged && height > 18 && height % (local ? 12 : 22) < 1.9 ? -15 : 0;
        const shade = submerged ? Math.max(-21, height * .5) : Math.min(48, height * .16) + contour;
        const color = submerged ? [51, 91, 99] : trail > .42 ? [171, 146, 102] : PALETTE[biome];
        for (let channel = 0; channel < 3; channel++) image.data[index + channel] = color[channel] + shade;
        image.data[index + 3] = 255;
      }
    }
    baseContext.putImageData(image, 0, 0);
  }

  function draw(position, heading, selected, found, beacon) {
    bake(position);
    context.imageSmoothingEnabled = true;
    context.drawImage(base, 0, 0, span, span);
    context.strokeStyle = '#ede7ce32';
    for (let line = 1; line < 6; line++) {
      const p = Math.floor(span * line / 6) + .5;
      context.beginPath();
      context.moveTo(p, 0); context.lineTo(p, span);
      context.moveTo(0, p); context.lineTo(span, p);
      context.stroke();
    }
    const player = xy(position.x, position.z);
    if (selected) {
      context.setLineDash([3, 5]);
      context.strokeStyle = '#ffdd9a';
      context.beginPath();
      context.moveTo(...player);
      context.lineTo(...xy(selected.x, selected.z));
      context.stroke();
      context.setLineDash([]);
    }
    for (const site of model.landmarks) {
      const [x, y] = xy(site.x, site.z);
      const radius = selected?.id === site.id ? 5 : 3.25;
      context.fillStyle = found.has(site.id) ? '#ffe3ab' : '#30423e';
      context.strokeStyle = '#ffe3ab';
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    if (beacon) {
      const [x, y] = xy(beacon.x, beacon.z);
      context.fillStyle = '#fca754';
      context.fillRect(x - 3, y - 3, 6, 6);
    }
    context.save();
    context.translate(...player);
    context.rotate(-heading);
    context.fillStyle = '#f6ffff';
    context.strokeStyle = '#1d3836';
    context.beginPath();
    context.moveTo(0, -8); context.lineTo(5, 5); context.lineTo(0, 3); context.lineTo(-5, 5); context.closePath();
    context.fill();
    context.stroke();
    context.restore();

    const meters = local ? 200 : 1000;
    context.fillStyle = '#102021e5';
    context.fillRect(6, span - 27, 67, 21);
    context.fillStyle = '#ffffff';
    context.fillRect(11, span - 12, meters / width * span, 2);
    context.font = '10px system-ui';
    context.fillText(local ? '200 m' : '1 km', 11, span - 15);
  }

  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    const cx = (event.clientX - rect.left) * span / rect.width;
    const cy = (event.clientY - rect.top) * span / rect.height;
    let nearest;
    let distance = 12;
    for (const site of model.landmarks) {
      const [x, y] = xy(site.x, site.z);
      const delta = Math.hypot(cx - x, cy - y);
      if (delta < distance) {
        nearest = site;
        distance = delta;
      }
    }
    if (nearest) onPick(nearest);
  });

  return { draw, setLocal(value) { local = value; } };
}
