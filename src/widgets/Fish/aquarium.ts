import type { FishSpeed, FishWater } from '../../types';
import { resolveFishColours } from './palette';

export interface AquariumSettings {
  fishCount: number;
  colours: string[];
  speed: FishSpeed;
  water: FishWater;
  bubbles: boolean;
  plants: boolean;
}

export interface AquariumController {
  start(): void;
  stop(): void;
  renderStatic(): void;
  update(settings: AquariumSettings): void;
  dropFood(x: number, y: number): void;
  dropFoodFromSurface(): void;
  setPointer(x: number, y: number): void;
  clearPointer(): void;
  dispose(): void;
}

interface FishEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  colour: string;
  phase: number;
  facing: number;
  tilt: number;
  wander: number;
  offsetAngle: number;
  burst: number;
}

interface Pellet {
  x: number;
  y: number;
  vy: number;
  size: number;
  colour: string;
  phase: number;
  life: number;
  settled: number;
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  life: number;
}

interface Plant {
  x: number;
  height: number;
  phase: number;
  colour: string;
}

interface Pebble {
  x: number;
  y: number;
  rx: number;
  ry: number;
  colour: string;
}

const SPEED_FACTOR: Record<FishSpeed, number> = {
  calm: 0.66,
  normal: 1,
  lively: 1.55,
};

const WATER_THEMES: Record<FishWater, { top: string; mid: string; bottom: string; light: string }> = {
  reef: {
    top: '#0c5876',
    mid: '#073746',
    bottom: '#031a24',
    light: 'rgba(118, 225, 255, 0.09)',
  },
  lagoon: {
    top: '#0d766c',
    mid: '#074740',
    bottom: '#022320',
    light: 'rgba(153, 255, 227, 0.09)',
  },
  freshwater: {
    top: '#226b43',
    mid: '#10452a',
    bottom: '#061f14',
    light: 'rgba(186, 255, 199, 0.09)',
  },
  night: {
    top: '#102a61',
    mid: '#07143a',
    bottom: '#02071c',
    light: 'rgba(150, 180, 255, 0.10)',
  },
};

const PLANT_COLOURS = [
  'rgba(80, 160, 105, 0.85)',
  'rgba(63, 137, 93, 0.78)',
  'rgba(105, 177, 109, 0.72)',
  'rgba(56, 121, 89, 0.8)',
];

const PEBBLE_COLOURS = [
  'rgba(91, 111, 116, 0.75)',
  'rgba(112, 119, 112, 0.68)',
  'rgba(72, 91, 96, 0.78)',
  'rgba(127, 116, 92, 0.55)',
];

const FOOD_COLOURS = ['#c88a3d', '#b8732d', '#e0aa58'];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalised = hex.replace('#', '');
  if (normalised.length === 3) {
    return {
      r: parseInt(normalised[0] + normalised[0], 16),
      g: parseInt(normalised[1] + normalised[1], 16),
      b: parseInt(normalised[2] + normalised[2], 16),
    };
  }
  return {
    r: parseInt(normalised.slice(0, 2), 16),
    g: parseInt(normalised.slice(2, 4), 16),
    b: parseInt(normalised.slice(4, 6), 16),
  };
}

function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const mix = Math.abs(amount);
  return `rgb(${Math.round(r + (target - r) * mix)}, ${Math.round(g + (target - g) * mix)}, ${Math.round(b + (target - b) * mix)})`;
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normaliseSettings(settings: AquariumSettings): AquariumSettings {
  const fishCount = Math.min(12, Math.max(1, Math.round(settings.fishCount) || 1));
  return {
    ...settings,
    fishCount,
    colours: resolveFishColours(settings.colours, fishCount),
  };
}

function noopController(): AquariumController {
  const noop = () => undefined;
  return {
    start: noop,
    stop: noop,
    renderStatic: noop,
    update: noop,
    dropFood: noop,
    dropFoodFromSurface: noop,
    setPointer: noop,
    clearPointer: noop,
    dispose: noop,
  };
}

export function createAquarium(
  canvas: HTMLCanvasElement,
  initialSettings: AquariumSettings,
): AquariumController {
  const context = canvas.getContext('2d');
  if (!context) return noopController();

  const ctx = context;
  let settings = normaliseSettings(initialSettings);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let fish: FishEntity[] = [];
  let pellets: Pellet[] = [];
  let bubbles: Bubble[] = [];
  let ripples: Ripple[] = [];
  let plants: Plant[] = [];
  let pebbles: Pebble[] = [];
  let pointer = { x: 0, y: 0, active: false };
  let time = 0;
  let running = false;
  let frameHandle = 0;
  let lastFrame = 0;
  let destroyed = false;
  let resizeObserver: ResizeObserver | null = null;

  const makeFish = (index: number): FishEntity => {
    const fallbackWidth = width || 320;
    const fallbackHeight = height || 190;
    const size = 9 + Math.random() * 5;
    return {
      x: fallbackWidth * (0.16 + Math.random() * 0.68),
      y: fallbackHeight * (0.24 + Math.random() * 0.5),
      vx: (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 12),
      vy: (Math.random() - 0.5) * 5,
      size,
      maxSize: size + 3.5,
      colour: settings.colours[index % settings.colours.length] ?? '#ffb347',
      phase: Math.random() * Math.PI * 2,
      facing: Math.random() < 0.5 ? -1 : 1,
      tilt: 0,
      wander: Math.random() * Math.PI * 2,
      offsetAngle: (index / Math.max(1, settings.fishCount)) * Math.PI * 2 + Math.random() * 0.4,
      burst: 0,
    };
  };

  const syncFish = () => {
    while (fish.length < settings.fishCount) fish.push(makeFish(fish.length));
    if (fish.length > settings.fishCount) fish.length = settings.fishCount;
    fish.forEach((item, index) => {
      item.colour = settings.colours[index % settings.colours.length] ?? item.colour;
    });
  };

  const rebuildDecor = () => {
    const bubbleCount = Math.round(clampNumber(width / 72, 6, 16));
    bubbles = Array.from({ length: bubbleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.4 + Math.random() * 2.8,
      speed: 12 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
    }));

    const plantCount = Math.round(clampNumber(width / 95, 3, 7));
    plants = Array.from({ length: plantCount }, (_, index) => ({
      x: width * (0.08 + (index + Math.random() * 0.6) * (0.84 / plantCount)),
      height: height * (0.22 + Math.random() * 0.28),
      phase: Math.random() * Math.PI * 2,
      colour: PLANT_COLOURS[index % PLANT_COLOURS.length],
    }));

    const pebbleCount = Math.round(clampNumber(width / 22, 14, 42));
    pebbles = Array.from({ length: pebbleCount }, () => ({
      x: Math.random() * width,
      y: height - Math.random() * 10,
      rx: 2.5 + Math.random() * 6,
      ry: 1.5 + Math.random() * 3,
      colour: PEBBLE_COLOURS[Math.floor(Math.random() * PEBBLE_COLOURS.length)],
    }));
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(120, Math.round(rect.width) || 320);
    const nextHeight = Math.max(90, Math.round(rect.height) || 190);
    const nextDpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;

    const oldWidth = width;
    const oldHeight = height;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (oldWidth > 0 && oldHeight > 0) {
      const scaleX = width / oldWidth;
      const scaleY = height / oldHeight;
      fish.forEach((item) => {
        item.x *= scaleX;
        item.y *= scaleY;
      });
      pellets.forEach((item) => {
        item.x *= scaleX;
        item.y *= scaleY;
      });
    }

    syncFish();
    rebuildDecor();
    if (!running) draw();
  };

  const addRipple = (x: number, y: number, life = 0.55) => {
    ripples.push({ x, y, radius: 4, life });
  };

  const dropFood = (x: number, y: number) => {
    if (width === 0) resize();
    const px = clampNumber(x, 8, Math.max(8, width - 8));
    const py = clampNumber(y, 6, Math.max(6, height - 10));
    pellets.push({
      x: px,
      y: py,
      vy: 5,
      size: 1.8 + Math.random() * 1.2,
      colour: FOOD_COLOURS[Math.floor(Math.random() * FOOD_COLOURS.length)],
      phase: Math.random() * Math.PI * 2,
      life: 0,
      settled: 0,
    });
    addRipple(px, Math.min(py, 18), 0.45);
    if (!running) draw();
  };

  const dropFoodFromSurface = () => {
    if (width === 0) resize();
    for (let index = 0; index < 3; index += 1) {
      dropFood(width * (0.22 + Math.random() * 0.56), 8);
    }
  };

  const stepFish = (item: FishEntity, delta: number) => {
    const speedFactor = SPEED_FACTOR[settings.speed] ?? 1;
    let nearest: Pellet | null = null;
    let nearestDistance = Infinity;
    for (const pellet of pellets) {
      const distance = Math.hypot(pellet.x - item.x, pellet.y - item.y);
      if (distance < nearestDistance && distance < 220) {
        nearest = pellet;
        nearestDistance = distance;
      }
    }

    let targetX = item.x;
    let targetY = item.y;
    if (nearest) {
      targetX = nearest.x;
      targetY = nearest.y;
      item.burst = Math.min(1.6, item.burst + delta * 1.8);
    } else if (pointer.active) {
      const orbit = 18 + item.size;
      targetX = pointer.x + Math.cos(item.offsetAngle + time * 0.45) * orbit;
      targetY = pointer.y + Math.sin(item.offsetAngle + time * 0.45) * orbit * 0.75;
      item.burst = Math.max(0, item.burst - delta * 0.7);
    } else {
      item.wander +=
        (Math.sin(time * 0.75 + item.phase) * 0.75 + (Math.random() - 0.5) * 0.65) * delta;
      targetX = item.x + Math.cos(item.wander) * 120;
      targetY = item.y + Math.sin(item.wander) * 120;
      item.burst = Math.max(0, item.burst - delta * 0.5);
    }

    const dx = targetX - item.x;
    const dy = targetY - item.y;
    const distance = Math.hypot(dx, dy) || 1;
    const maxSpeed =
      (23 + Math.min(9, item.size * 0.45)) * speedFactor * (1 + item.burst * 0.85);
    let desiredX = (dx / distance) * maxSpeed;
    let desiredY = (dy / distance) * maxSpeed + Math.sin(time * 1.4 + item.phase) * 4;

    const margin = 26;
    const wallForce = 55 * speedFactor;
    if (item.x < margin) desiredX += ((margin - item.x) / margin) * wallForce;
    if (item.x > width - margin) {
      desiredX -= ((item.x - (width - margin)) / margin) * wallForce;
    }
    if (item.y < margin) desiredY += ((margin - item.y) / margin) * wallForce;
    if (item.y > height - margin) {
      desiredY -= ((item.y - (height - margin)) / margin) * wallForce;
    }

    for (const other of fish) {
      if (other === item) continue;
      const separateX = item.x - other.x;
      const separateY = item.y - other.y;
      const separateDistance = Math.hypot(separateX, separateY) || 1;
      const personalSpace = (item.size + other.size) * 1.15;
      if (separateDistance < personalSpace) {
        const push = ((personalSpace - separateDistance) / personalSpace) * 45;
        desiredX += (separateX / separateDistance) * push;
        desiredY += (separateY / separateDistance) * push;
      }
    }

    const turn = Math.min(1, delta * 2.1);
    item.vx += (desiredX - item.vx) * turn;
    item.vy += (desiredY - item.vy) * turn;
    const speed = Math.hypot(item.vx, item.vy);
    if (speed > maxSpeed * 1.2) {
      item.vx = (item.vx / speed) * maxSpeed * 1.2;
      item.vy = (item.vy / speed) * maxSpeed * 1.2;
    }

    item.x += item.vx * delta;
    item.y += item.vy * delta;
    item.x = clampNumber(item.x, item.size * 1.8, width - item.size * 1.8);
    item.y = clampNumber(item.y, item.size * 1.2, height - item.size * 1.2);

    const facingTarget = item.vx >= 0 ? 1 : -1;
    item.facing += (facingTarget - item.facing) * Math.min(1, delta * 4.5);
    const tiltTarget =
      Math.atan2(item.vy, Math.max(12, Math.abs(item.vx))) * (facingTarget >= 0 ? 1 : -1);
    item.tilt += (tiltTarget - item.tilt) * Math.min(1, delta * 3.2);
    item.phase += delta * (5 + Math.hypot(item.vx, item.vy) * 0.16);

    for (let index = pellets.length - 1; index >= 0; index -= 1) {
      const pellet = pellets[index];
      if (Math.hypot(pellet.x - item.x, pellet.y - item.y) < item.size * 0.9 + pellet.size) {
        pellets.splice(index, 1);
        addRipple(item.x, item.y, 0.5);
        item.size = Math.min(item.maxSize, item.size + 0.28);
        item.burst = 1.5;
      }
    }
  };

  const step = (delta: number) => {
    for (const pellet of pellets) {
      pellet.life += delta;
      if (pellet.y < height - 14) {
        pellet.vy = Math.min(30, pellet.vy + 18 * delta);
        pellet.y += pellet.vy * delta;
        pellet.x += Math.sin(time * 1.6 + pellet.phase) * 8 * delta;
      } else {
        pellet.y = height - 14;
        pellet.settled += delta;
      }
    }
    pellets = pellets.filter((pellet) => pellet.life < 16 && pellet.settled < 7);

    for (const item of fish) stepFish(item, delta);

    if (settings.bubbles) {
      for (const bubble of bubbles) {
        bubble.y -= bubble.speed * delta;
        if (bubble.y < -8) {
          bubble.y = height + 6;
          bubble.x = Math.random() * width;
        }
      }
    }

    for (const ripple of ripples) {
      ripple.radius += 34 * delta;
      ripple.life -= delta;
    }
    ripples = ripples.filter((ripple) => ripple.life > 0);
  };

  const drawWater = () => {
    const theme = WATER_THEMES[settings.water] ?? WATER_THEMES.reef;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, theme.top);
    gradient.addColorStop(0.55, theme.mid);
    gradient.addColorStop(1, theme.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = theme.light;
    for (let index = 0; index < 3; index += 1) {
      const x = width * (0.18 + index * 0.28) + Math.sin(time * 0.18 + index) * 12;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 34, 0);
      ctx.lineTo(x + 132, height);
      ctx.lineTo(x + 74, height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  const drawPlants = () => {
    if (!settings.plants) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (const plant of plants) {
      ctx.strokeStyle = plant.colour;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(plant.x, height);
      let previousX = plant.x;
      let previousY = height;
      const segments = 7;
      for (let index = 1; index <= segments; index += 1) {
        const progress = index / segments;
        const nextX =
          plant.x + Math.sin(time * 0.9 + plant.phase + progress * 2.3) * 13 * progress;
        const nextY = height - plant.height * progress;
        const controlX =
          (previousX + nextX) / 2 +
          Math.sin(time * 0.8 + plant.phase + progress * 3.4) * 5;
        const controlY = (previousY + nextY) / 2;
        ctx.quadraticCurveTo(controlX, controlY, nextX, nextY);
        previousX = nextX;
        previousY = nextY;
      }
      ctx.stroke();

      for (const progress of [0.38, 0.64]) {
        const leafX =
          plant.x + Math.sin(time * 0.9 + plant.phase + progress * 2.3) * 13 * progress;
        const leafY = height - plant.height * progress;
        ctx.save();
        ctx.translate(leafX, leafY);
        ctx.rotate(-0.45 + Math.sin(time * 0.7 + plant.phase + progress) * 0.14);
        ctx.fillStyle = plant.colour;
        ctx.beginPath();
        ctx.ellipse(8, 0, 9, 3.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  };

  const drawGravel = () => {
    if (!settings.plants) return;
    for (const pebble of pebbles) {
      ctx.fillStyle = pebble.colour;
      ctx.beginPath();
      ctx.ellipse(pebble.x, pebble.y, pebble.rx, pebble.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const floor = ctx.createLinearGradient(0, height - 18, 0, height);
    floor.addColorStop(0, 'rgba(4, 14, 18, 0)');
    floor.addColorStop(1, 'rgba(2, 8, 11, 0.65)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, height - 18, width, 18);
  };

  const drawPellet = (pellet: Pellet) => {
    ctx.fillStyle = pellet.colour;
    ctx.beginPath();
    ctx.arc(pellet.x, pellet.y, pellet.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 236, 190, 0.5)';
    ctx.beginPath();
    ctx.arc(pellet.x - pellet.size * 0.3, pellet.y - pellet.size * 0.35, pellet.size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawFish = (item: FishEntity) => {
    const size = item.size;
    const wiggle = Math.sin(item.phase) * 0.35;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.tilt);
    ctx.scale(item.facing || 1, 1);

    ctx.fillStyle = shade(item.colour, -0.3);
    ctx.beginPath();
    ctx.moveTo(-size * 1.02, 0);
    ctx.quadraticCurveTo(
      -size * 1.7,
      -size * 0.82 + wiggle * size,
      -size * 2.1,
      -size * 0.33 + wiggle * size * 1.3,
    );
    ctx.quadraticCurveTo(-size * 1.9, 0, -size * 2.1, size * 0.33 + wiggle * size * 1.3);
    ctx.quadraticCurveTo(
      -size * 1.7,
      size * 0.82 + wiggle * size,
      -size * 1.02,
      0,
    );
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = withAlpha(item.colour, 0.58);
    ctx.beginPath();
    ctx.moveTo(-size * 0.48, -size * 0.62);
    ctx.quadraticCurveTo(-size * 0.15, -size * 1.45, size * 0.38, -size * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-size * 0.32, size * 0.54);
    ctx.quadraticCurveTo(size * 0.05, size * 1.05, size * 0.4, size * 0.5);
    ctx.closePath();
    ctx.fill();

    const bodyGradient = ctx.createLinearGradient(0, -size, 0, size);
    bodyGradient.addColorStop(0, shade(item.colour, 0.34));
    bodyGradient.addColorStop(0.48, item.colour);
    bodyGradient.addColorStop(1, shade(item.colour, -0.3));
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.28, size * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = withAlpha(item.colour, 0.48);
    ctx.beginPath();
    ctx.ellipse(size * 0.18, size * 0.32, size * 0.34, size * 0.14, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = withAlpha(shade(item.colour, -0.45), 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size * 0.38, -size * 0.46);
    ctx.quadraticCurveTo(size * 0.18, 0, size * 0.38, size * 0.46);
    ctx.stroke();

    ctx.fillStyle = '#f7fbff';
    ctx.beginPath();
    ctx.arc(size * 0.66, -size * 0.18, size * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#07131b';
    ctx.beginPath();
    ctx.arc(size * 0.71, -size * 0.18, size * 0.095, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(size * 0.75, -size * 0.22, size * 0.032, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = withAlpha(shade(item.colour, -0.5), 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size * 1.2, size * 0.1, size * 0.12, -0.55, 0.75);
    ctx.stroke();
    ctx.restore();
  };

  const drawBubbles = () => {
    if (!settings.bubbles) return;
    for (const bubble of bubbles) {
      const x = bubble.x + Math.sin(time * 1.3 + bubble.phase) * 5;
      ctx.strokeStyle = 'rgba(221, 246, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, bubble.y, bubble.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.beginPath();
      ctx.arc(x - bubble.radius * 0.28, bubble.y - bubble.radius * 0.3, bubble.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawRipples = () => {
    for (const ripple of ripples) {
      ctx.strokeStyle = `rgba(218, 247, 255, ${Math.max(0, ripple.life) * 0.85})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, ripple.radius, ripple.radius * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const drawGlass = () => {
    ctx.strokeStyle = 'rgba(210, 240, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    const surface = ctx.createLinearGradient(0, 0, 0, 12);
    surface.addColorStop(0, 'rgba(202, 242, 255, 0.18)');
    surface.addColorStop(1, 'rgba(202, 242, 255, 0)');
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, width, 12);

    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.2,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 6, 10, 0.36)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  };

  const draw = () => {
    if (width === 0 || height === 0) return;
    ctx.clearRect(0, 0, width, height);
    drawWater();
    drawGravel();
    drawPlants();
    for (const pellet of pellets) drawPellet(pellet);
    for (const item of [...fish].sort((a, b) => a.y - b.y)) drawFish(item);
    drawBubbles();
    drawRipples();
    drawGlass();
  };

  const frame = (now: number) => {
    if (!running) return;
    const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (delta > 0) {
      time += delta;
      step(delta);
    }
    draw();
    frameHandle = window.requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || destroyed) return;
    resize();
    syncFish();
    running = true;
    lastFrame = performance.now();
    frameHandle = window.requestAnimationFrame(frame);
  };

  const stop = () => {
    running = false;
    window.cancelAnimationFrame(frameHandle);
  };

  const renderStatic = () => {
    resize();
    syncFish();
    draw();
  };

  const update = (nextSettings: AquariumSettings) => {
    settings = normaliseSettings(nextSettings);
    syncFish();
    if (!running) draw();
  };

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  resize();
  syncFish();

  return {
    start,
    stop,
    renderStatic,
    update,
    dropFood,
    dropFoodFromSurface,
    setPointer: (x, y) => {
      pointer = {
        x: clampNumber(x, 0, width),
        y: clampNumber(y, 0, height),
        active: true,
      };
    },
    clearPointer: () => {
      pointer = { ...pointer, active: false };
    },
    dispose: () => {
      destroyed = true;
      stop();
      resizeObserver?.disconnect();
      if (typeof ResizeObserver === 'undefined') {
        window.removeEventListener('resize', resize);
      }
    },
  };
}
