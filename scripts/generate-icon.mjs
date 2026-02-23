import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Open Planner Studio icon: A stylized Gantt chart within a rounded square
// Uses the app's accent blue (#2563EB) with dark surface background (#1e1e2e)
const SIZE = 1024;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e2a4a"/>
      <stop offset="100%" stop-color="#0f1729"/>
    </linearGradient>
    <!-- Accent gradient for bars -->
    <linearGradient id="bar1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
    <linearGradient id="bar2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="bar3" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#34D399"/>
    </linearGradient>
    <linearGradient id="bar4" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#DC2626"/>
      <stop offset="100%" stop-color="#EF4444"/>
    </linearGradient>
    <linearGradient id="bar5" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#FBBF24"/>
    </linearGradient>
    <!-- Subtle inner shadow -->
    <filter id="innerGlow">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur"/>
      <feOffset dx="0" dy="4"/>
      <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1"/>
      <feFlood flood-color="#3B82F6" flood-opacity="0.15"/>
      <feComposite operator="in" in2="SourceGraphic"/>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <!-- Drop shadow for bars -->
    <filter id="barShadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Rounded square background -->
  <rect x="32" y="32" width="960" height="960" rx="200" ry="200" fill="url(#bg)"/>

  <!-- Subtle border -->
  <rect x="32" y="32" width="960" height="960" rx="200" ry="200"
        fill="none" stroke="#2563EB" stroke-width="3" stroke-opacity="0.3"/>

  <!-- Grid lines (subtle vertical time markers) -->
  <g opacity="0.08" stroke="#e0e0e8" stroke-width="2">
    <line x1="320" y1="180" x2="320" y2="844"/>
    <line x1="460" y1="180" x2="460" y2="844"/>
    <line x1="600" y1="180" x2="600" y2="844"/>
    <line x1="740" y1="180" x2="740" y2="844"/>
  </g>

  <!-- Horizontal row separators -->
  <g opacity="0.06" stroke="#e0e0e8" stroke-width="1.5">
    <line x1="160" y1="308" x2="880" y2="308"/>
    <line x1="160" y1="436" x2="880" y2="436"/>
    <line x1="160" y1="564" x2="880" y2="564"/>
    <line x1="160" y1="692" x2="880" y2="692"/>
  </g>

  <!-- Gantt bars with rounded ends -->
  <g filter="url(#barShadow)">
    <!-- Bar 1: Long blue bar (normal task) -->
    <rect x="200" y="222" width="520" height="56" rx="10" ry="10" fill="url(#bar1)"/>

    <!-- Bar 2: Medium purple bar (milestone area) -->
    <rect x="280" y="350" width="340" height="56" rx="10" ry="10" fill="url(#bar2)"/>

    <!-- Bar 3: Short green bar (float task) -->
    <rect x="440" y="478" width="280" height="56" rx="10" ry="10" fill="url(#bar3)"/>

    <!-- Bar 4: Red bar (critical path) -->
    <rect x="200" y="606" width="600" height="56" rx="10" ry="10" fill="url(#bar4)"/>

    <!-- Bar 5: Amber bar -->
    <rect x="340" y="734" width="400" height="56" rx="10" ry="10" fill="url(#bar5)"/>
  </g>

  <!-- Small left-side task labels (abstract rectangles) -->
  <g opacity="0.25" fill="#e0e0e8">
    <rect x="120" y="238" width="50" height="8" rx="4"/>
    <rect x="120" y="252" width="35" height="8" rx="4"/>
    <rect x="120" y="366" width="45" height="8" rx="4"/>
    <rect x="120" y="380" width="30" height="8" rx="4"/>
    <rect x="120" y="494" width="40" height="8" rx="4"/>
    <rect x="120" y="508" width="50" height="8" rx="4"/>
    <rect x="120" y="622" width="48" height="8" rx="4"/>
    <rect x="120" y="636" width="32" height="8" rx="4"/>
    <rect x="120" y="750" width="42" height="8" rx="4"/>
    <rect x="120" y="764" width="38" height="8" rx="4"/>
  </g>

  <!-- Dependency arrows (connecting lines between bars) -->
  <g fill="none" stroke="#9090a8" stroke-width="3" stroke-opacity="0.5">
    <!-- Bar 1 end to Bar 2 start -->
    <path d="M 620 278 L 620 320 Q 620 335 605 335 L 290 335 Q 280 335 280 350"/>
    <!-- Bar 2 end to Bar 3 start -->
    <path d="M 520 406 L 520 448 Q 520 463 505 463 L 450 463 Q 440 463 440 478"/>
    <!-- Bar 3 end to Bar 5 start -->
    <path d="M 620 534 L 620 700 Q 620 720 600 720 L 350 720 Q 340 720 340 734"/>
  </g>

  <!-- Dependency arrow heads -->
  <g fill="#9090a8" opacity="0.5">
    <polygon points="274,350 280,340 286,350"/>
    <polygon points="434,478 440,468 446,478"/>
    <polygon points="334,734 340,724 346,734"/>
  </g>

  <!-- Today line (vertical amber dashed) -->
  <line x1="680" y1="180" x2="680" y2="844" stroke="#F59E0B" stroke-width="3" stroke-opacity="0.6" stroke-dasharray="12,8"/>

  <!-- Small diamond milestone marker on bar 4 -->
  <g transform="translate(800, 634) rotate(45)" fill="#fff" opacity="0.9">
    <rect x="-12" y="-12" width="24" height="24" rx="3"/>
  </g>

  <!-- Subtle progress fills on some bars -->
  <rect x="200" y="222" width="340" height="56" rx="10" ry="10" fill="#fff" opacity="0.1"/>
  <rect x="200" y="606" width="420" height="56" rx="10" ry="10" fill="#fff" opacity="0.1"/>
</svg>`;

async function generateIcons() {
  const iconsDir = path.resolve('src-tauri/icons');
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  // Generate the master 1024x1024 PNG
  const masterPng = path.resolve('app-icon.png');
  await sharp(Buffer.from(svg)).png().toFile(masterPng);
  console.log('Created app-icon.png (1024x1024)');

  // Generate PNG icons at various sizes
  const pngSizes = [
    { size: 32, name: '32x32.png' },
    { size: 128, name: '128x128.png' },
    { size: 256, name: '128x128@2x.png' },
  ];

  for (const { size, name } of pngSizes) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(iconsDir, name));
    console.log(`Created ${name} (${size}x${size})`);
  }

  // Generate ICO (multi-size: 16, 24, 32, 48, 64, 128, 256)
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBuffers = [];

  for (const size of icoSizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).raw().ensureAlpha().toBuffer();
    icoBuffers.push({ size, data: buf });
  }

  const icoFile = buildIco(icoBuffers);
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoFile);
  console.log('Created icon.ico (multi-size)');

  // Generate ICNS for macOS using sharp to create individual PNGs
  // Tauri's `tauri icon` command can do this better, but let's provide what we can
  const icnsSizes = [
    { size: 16, name: '16x16.png' },
    { size: 32, name: '32x32.png' },
    { size: 64, name: '64x64.png' },
    { size: 128, name: '128x128.png' },
    { size: 256, name: '256x256.png' },
    { size: 512, name: '512x512.png' },
    { size: 1024, name: '1024x1024.png' },
  ];

  // Store PNGs needed for icns generation
  const icnsData = {};
  for (const { size, name } of icnsSizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    icnsData[size] = buf;
  }

  const icnsFile = buildIcns(icnsData);
  fs.writeFileSync(path.join(iconsDir, 'icon.icns'), icnsFile);
  console.log('Created icon.icns (macOS)');

  console.log('\nAll icons generated successfully!');
}

// Build ICO file from raw BGRA buffers
function buildIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  let dataOffset = headerSize + entrySize * images.length;
  const entries = [];
  const datas = [];

  for (const img of images) {
    const { size, data } = img;
    const width = size >= 256 ? 0 : size;
    const height = size >= 256 ? 0 : size;

    // BMP info header (BITMAPINFOHEADER)
    const bihSize = 40;
    const rowSize = size * 4; // BGRA
    const pixelDataSize = rowSize * size;
    const andMaskRowSize = Math.ceil(size / 32) * 4;
    const andMaskSize = andMaskRowSize * size;
    const imageSize = bihSize + pixelDataSize + andMaskSize;

    const bmpBuf = Buffer.alloc(imageSize);
    let offset = 0;

    // BITMAPINFOHEADER
    bmpBuf.writeUInt32LE(bihSize, offset); offset += 4;
    bmpBuf.writeInt32LE(size, offset); offset += 4;
    bmpBuf.writeInt32LE(size * 2, offset); offset += 4;
    bmpBuf.writeUInt16LE(1, offset); offset += 2;
    bmpBuf.writeUInt16LE(32, offset); offset += 2;
    bmpBuf.writeUInt32LE(0, offset); offset += 4;
    bmpBuf.writeUInt32LE(pixelDataSize + andMaskSize, offset); offset += 4;
    bmpBuf.writeInt32LE(0, offset); offset += 4;
    bmpBuf.writeInt32LE(0, offset); offset += 4;
    bmpBuf.writeUInt32LE(0, offset); offset += 4;
    bmpBuf.writeUInt32LE(0, offset); offset += 4;

    // Pixel data (BGRA, bottom-up)
    for (let y = size - 1; y >= 0; y--) {
      for (let x = 0; x < size; x++) {
        const srcIdx = (y * size + x) * 4;
        const dstIdx = offset + ((size - 1 - y) * size + x) * 4;
        bmpBuf[dstIdx + 0] = data[srcIdx + 2]; // B
        bmpBuf[dstIdx + 1] = data[srcIdx + 1]; // G
        bmpBuf[dstIdx + 2] = data[srcIdx + 0]; // R
        bmpBuf[dstIdx + 3] = data[srcIdx + 3]; // A
      }
    }
    offset += pixelDataSize;

    // AND mask (all zeros = fully opaque)
    // Already zeroed by Buffer.alloc

    entries.push({ width, height, imageSize, dataOffset });
    datas.push(bmpBuf);
    dataOffset += imageSize;
  }

  const totalSize = dataOffset;
  const ico = Buffer.alloc(totalSize);
  let pos = 0;

  // ICO header
  ico.writeUInt16LE(0, pos); pos += 2;     // reserved
  ico.writeUInt16LE(1, pos); pos += 2;     // type = ICO
  ico.writeUInt16LE(images.length, pos); pos += 2; // count

  // Directory entries
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    ico.writeUInt8(e.width, pos); pos += 1;
    ico.writeUInt8(e.height, pos); pos += 1;
    ico.writeUInt8(0, pos); pos += 1;       // color palette
    ico.writeUInt8(0, pos); pos += 1;       // reserved
    ico.writeUInt16LE(1, pos); pos += 2;    // planes
    ico.writeUInt16LE(32, pos); pos += 2;   // bits per pixel
    ico.writeUInt32LE(e.imageSize, pos); pos += 4;
    ico.writeUInt32LE(e.dataOffset, pos); pos += 4;
  }

  // Image data
  for (const data of datas) {
    data.copy(ico, pos);
    pos += data.length;
  }

  return ico;
}

// Build ICNS file from PNG buffers
function buildIcns(pngData) {
  // ICNS type mapping (size -> OSType)
  const types = [
    { size: 16, type: 'icp4' },   // 16x16 PNG
    { size: 32, type: 'icp5' },   // 32x32 PNG
    { size: 64, type: 'icp6' },   // 64x64 PNG
    { size: 128, type: 'ic07' },  // 128x128 PNG
    { size: 256, type: 'ic08' },  // 256x256 PNG
    { size: 512, type: 'ic09' },  // 512x512 PNG
    { size: 1024, type: 'ic10' }, // 1024x1024 PNG
  ];

  let totalSize = 8; // 'icns' header
  const entries = [];

  for (const { size, type } of types) {
    if (pngData[size]) {
      const entrySize = 8 + pngData[size].length;
      entries.push({ type, data: pngData[size], entrySize });
      totalSize += entrySize;
    }
  }

  const buf = Buffer.alloc(totalSize);
  let pos = 0;

  // File header
  buf.write('icns', pos); pos += 4;
  buf.writeUInt32BE(totalSize, pos); pos += 4;

  // Entries
  for (const entry of entries) {
    buf.write(entry.type, pos); pos += 4;
    buf.writeUInt32BE(entry.entrySize, pos); pos += 4;
    entry.data.copy(buf, pos);
    pos += entry.data.length;
  }

  return buf;
}

generateIcons().catch(console.error);
