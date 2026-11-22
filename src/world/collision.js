import { WORLD_BOUNDS } from './terrain.js';

const CELL_SIZE = 12;

function cellIndex(value) {
  return Math.floor(value / CELL_SIZE);
}

function cellKey(x, z) {
  return x + ':' + z;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function createCollision() {
  const cells = new Map();

  function addShape(shape, extentX, extentZ) {
    for (let z = cellIndex(shape.z - extentZ); z <= cellIndex(shape.z + extentZ); z++) {
      for (let x = cellIndex(shape.x - extentX); x <= cellIndex(shape.x + extentX); x++) {
        const key = cellKey(x, z);
        const shapes = cells.get(key);
        if (shapes) shapes.push(shape);
        else cells.set(key, [shape]);
      }
    }
  }

  function addCircle(x, z, radius) {
    addShape({ x, z, radius }, radius, radius);
  }

  function addBox(x, z, width, depth) {
    addShape({ x, z, halfWidth: width * 0.5, halfDepth: depth * 0.5 },
      width * 0.5, depth * 0.5);
  }

  function isBlocked(x, z, radius) {
    for (let row = cellIndex(z - radius); row <= cellIndex(z + radius); row++) {
      for (let column = cellIndex(x - radius); column <= cellIndex(x + radius); column++) {
        const shapes = cells.get(cellKey(column, row));
        if (!shapes) continue;
        for (const shape of shapes) {
          let dx = x - shape.x;
          let dz = z - shape.z;
          let reach = radius;
          if (shape.radius !== undefined) {
            reach += shape.radius;
          } else {
            dx -= clamp(dx, -shape.halfWidth, shape.halfWidth);
            dz -= clamp(dz, -shape.halfDepth, shape.halfDepth);
          }
          if (dx * dx + dz * dz < reach * reach) return true;
        }
      }
    }
    return false;
  }

  function resolveMovement(fromX, fromZ, toX, toZ, radius = 0.4) {
    const targetX = clamp(toX, WORLD_BOUNDS.minX + radius, WORLD_BOUNDS.maxX - radius);
    const targetZ = clamp(toZ, WORLD_BOUNDS.minZ + radius, WORLD_BOUNDS.maxZ - radius);
    const steps = Math.max(1, Math.ceil(Math.hypot(targetX - fromX, targetZ - fromZ) / 0.4));
    const dx = (targetX - fromX) / steps;
    const dz = (targetZ - fromZ) / steps;
    let x = fromX;
    let z = fromZ;
    for (let step = 0; step < steps; step++) {
      if (!isBlocked(x + dx, z, radius)) x += dx;
      if (!isBlocked(x, z + dz, radius)) z += dz;
    }
    return { x, z };
  }

  return { addCircle, addBox, resolveMovement, isBlocked };
}
