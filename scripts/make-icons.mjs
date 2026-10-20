import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'public', 'icons');
mkdirSync(outputDir, { recursive: true });

const SIZES = [16, 32, 48, 128, 192, 512];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuffer, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    scanlines[y * (width * 4 + 1)] = 0;
    rgba.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function inRoundedRect(x, y, inset, radius) {
  const min = inset;
  const max = 1 - inset;
  if (x < min || x > max || y < min || y > max) return false;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 || (x >= min + radius && x <= max - radius) || (y >= min + radius && y <= max - radius);
}

function sample(x, y) {
  if (!inRoundedRect(x, y, 0.015, 0.22)) return [0, 0, 0, 0];

  // Outer metal frame
  const frame = mix([65, 86, 112], [24, 36, 50], Math.min(1, Math.max(0, (y - 0.04) / 0.92)));
  let colour = frame;
  let alpha = 255;

  const dx = x - 0.5;
  const dy = y - 0.47;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.345) {
    // Glossy blue orb
    const light = Math.max(0, 1 - Math.sqrt((x - 0.36) ** 2 + (y - 0.27) ** 2) / 0.44);
    const orb = mix([26, 48, 70], [118, 169, 224], Math.min(1, light * 0.82 + 0.16));
    colour = orb;
    if (dist > 0.31) colour = mix([165, 198, 232], orb, 0.32);
  }

  if (dist < 0.25) {
    const shine = Math.max(0, 1 - Math.sqrt((x - 0.39) ** 2 + (y - 0.3) ** 2) / 0.15);
    colour = mix(colour, [232, 244, 255], shine * 0.55);
  }

  // Compass needle diamond
  const nx = Math.abs(x - 0.5);
  const ny = Math.abs(y - 0.45);
  if (ny < 0.27 && nx < 0.085 * (1 - ny / 0.27)) {
    const right = x > 0.5;
    colour = right ? [118, 169, 224] : [238, 246, 255];
    if (y > 0.45) colour = mix(colour, [28, 46, 66], 0.55);
  }
  const centerDist = Math.sqrt((x - 0.5) ** 2 + (y - 0.45) ** 2);
  if (centerDist < 0.032) colour = [18, 30, 44];

  return [Math.round(colour[0]), Math.round(colour[1]), Math.round(colour[2]), alpha];
}

function render(size) {
  const buffer = Buffer.alloc(size * size * 4);
  const samples = size <= 64 ? 4 : 1;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const [pr, pg, pb, pa] = sample(
            (x + (sx + 0.5) / samples) / size,
            (y + (sy + 0.5) / samples) / size,
          );
          const weight = pa / 255;
          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          a += pa;
        }
      }
      const count = samples * samples;
      const index = (y * size + x) * 4;
      const alpha = a / count;
      if (alpha > 0) {
        buffer[index] = Math.round(r / (alpha / 255 * count));
        buffer[index + 1] = Math.round(g / (alpha / 255 * count));
        buffer[index + 2] = Math.round(b / (alpha / 255 * count));
        buffer[index + 3] = Math.round(alpha);
      }
    }
  }
  return buffer;
}

for (const size of SIZES) {
  const rgba = render(size);
  writeFileSync(join(outputDir, `icon-${size}.png`), encodePng(size, size, rgba));
}

writeFileSync(
  join(outputDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="RetroPortal">
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#415670"/>
      <stop offset="1" stop-color="#182432"/>
    </linearGradient>
    <radialGradient id="orb" cx="38%" cy="30%" r="72%">
      <stop offset="0" stop-color="#a9cbea"/>
      <stop offset="0.45" stop-color="#76a9e0"/>
      <stop offset="1" stop-color="#1b334b"/>
    </radialGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".42"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#frame)" stroke="#0d151e" stroke-width="1.5"/>
  <circle cx="32" cy="29" r="20" fill="url(#orb)" stroke="#b6d3ed" stroke-width="1.6"/>
  <ellipse cx="25" cy="20" rx="7.5" ry="5" fill="url(#gloss)"/>
  <path d="M32 13 L38 29 L32 44 L26 29 Z" fill="#eef6ff"/>
  <path d="M32 13 L38 29 L32 29 Z" fill="#76a9e0"/>
  <path d="M38 29 L32 44 L32 29 Z" fill="#4b789f"/>
  <circle cx="32" cy="29" r="2.4" fill="#12202e"/>
</svg>
`,
);

console.log(`Generated ${SIZES.length} PNG icons and favicon.svg in public/icons`);
