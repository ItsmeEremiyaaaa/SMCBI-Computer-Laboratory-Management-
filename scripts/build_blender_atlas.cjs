const sharp = require('sharp');
const fs = require('fs');

const deskImgPath   = 'C:/Users/maria/.gemini/antigravity/brain/81edcee1-b032-4295-8f6c-fdf7e281df89/.user_uploaded/media_1794904531983_51f5ffe7.jpg';
const walkImgPath   = 'C:/Users/maria/.gemini/antigravity/brain/81edcee1-b032-4295-8f6c-fdf7e281df89/.user_uploaded/media_1794904620417_fed58bd3.jpg';
const teacherPath   = 'C:/Users/maria/.gemini/antigravity/brain/81edcee1-b032-4295-8f6c-fdf7e281df89/.user_uploaded/media_1794904884678_6643c63e.jpg';

function isBackgroundPixel(r, g, b) {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const diff = maxC - minC;

  // Ink outline and dark hair is very dark (< 26)
  if (maxC < 26) return false;

  // Floor gray and shadows: neutral gray with minC >= 41 and maxC <= 78
  if (minC >= 41 && maxC <= 78 && diff <= 12) return true;

  // Blender viewport axis lines (colored lines in grid)
  if ((r > 65 && g < 60 && b < 60) || (g > 65 && r < 60 && b < 60) || (r > 70 && g > 60 && b < 50)) {
    return true;
  }

  return false;
}

function extractSprite(buf, w, h, cx, yTop, targetW, targetH) {
  const x0 = Math.round(cx - targetW / 2);
  const tw = targetW;
  const th = targetH;
  const rgba = Buffer.alloc(tw * th * 4);

  for (let y = 0; y < th; y++) {
    const sy = yTop + y;
    for (let x = 0; x < tw; x++) {
      const sx = x0 + x;
      const dIdx = (y * tw + x) * 4;
      if (sy < 0 || sy >= h || sx < 0 || sx >= w) {
        rgba[dIdx + 3] = 0;
        continue;
      }
      const sIdx = (sy * w + sx) * 3;
      const r = buf[sIdx], g = buf[sIdx+1], b = buf[sIdx+2];

      rgba[dIdx] = r;
      rgba[dIdx + 1] = g;
      rgba[dIdx + 2] = b;

      if (isBackgroundPixel(r, g, b)) {
        rgba[dIdx + 3] = 0;
      } else {
        rgba[dIdx + 3] = 255;
      }
    }
  }
  return rgba;
}

async function buildAll() {
  const desk = await sharp(deskImgPath).raw().toBuffer({ resolveWithObject: true });
  const walk = await sharp(walkImgPath).raw().toBuffer({ resolveWithObject: true });
  const teacher = await sharp(teacherPath).raw().toBuffer({ resolveWithObject: true });

  const deskCenters = [92, 170, 249, 328, 407, 485, 563, 641, 720, 797, 874, 952];
  const stdCenters  = [95, 175, 253, 331, 409, 487, 564, 638, 716, 794, 872, 950];

  const cellW = 64;
  const cellH = 112;
  const cols = 12;
  const rows = 6;
  const atlasW = cols * cellW;
  const atlasH = rows * cellH;
  const atlasBuf = Buffer.alloc(atlasW * atlasH * 4);

  function blit(spriteBuf, sw, sh, col, row) {
    const destX0 = col * cellW + Math.floor((cellW - sw) / 2);
    const destY0 = row * cellH + (cellH - sh - 2);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dx = destX0 + x;
        const dy = destY0 + y;
        if (dx >= 0 && dx < atlasW && dy >= 0 && dy < atlasH) {
          const sIdx = (y * sw + x) * 4;
          const dIdx = (dy * atlasW + dx) * 4;
          atlasBuf[dIdx] = spriteBuf[sIdx];
          atlasBuf[dIdx+1] = spriteBuf[sIdx+1];
          atlasBuf[dIdx+2] = spriteBuf[sIdx+2];
          atlasBuf[dIdx+3] = spriteBuf[sIdx+3];
        }
      }
    }
  }

  // Row 0: Male Desk Interaction (sitting with hands typing, no chair)
  console.log('Extracting Row 0: Male Desk Interaction...');
  for (let k = 0; k < 12; k++) {
    const raw = extractSprite(desk.data, desk.info.width, desk.info.height, deskCenters[k], 330, 56, 96);
    const rz = await sharp(raw, { raw: { width: 56, height: 96, channels: 4 } })
      .resize({ height: 102, fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true });
    blit(rz.data, rz.info.width, rz.info.height, k, 0);
  }

  // Row 1: Female Desk Interaction (sitting with hands typing, no chair)
  console.log('Extracting Row 1: Female Desk Interaction...');
  for (let k = 0; k < 12; k++) {
    const raw = extractSprite(desk.data, desk.info.width, desk.info.height, deskCenters[k], 452, 56, 90);
    const rz = await sharp(raw, { raw: { width: 56, height: 90, channels: 4 } })
      .resize({ height: 100, fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true });
    blit(rz.data, rz.info.width, rz.info.height, k, 1);
  }

  // Row 2: Male Walk Cycle (12 directional walking angles)
  console.log('Extracting Row 2: Male Walk Cycle...');
  for (let k = 0; k < 12; k++) {
    const raw = extractSprite(walk.data, walk.info.width, walk.info.height, stdCenters[k], 97, 56, 166);
    const rz = await sharp(raw, { raw: { width: 56, height: 166, channels: 4 } })
      .resize({ height: 106, fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true });
    blit(rz.data, rz.info.width, rz.info.height, k, 2);
  }

  // Row 3: Female Walk Cycle (12 directional walking angles)
  console.log('Extracting Row 3: Female Walk Cycle...');
  for (let k = 0; k < 12; k++) {
    const raw = extractSprite(walk.data, walk.info.width, walk.info.height, stdCenters[k], 340, 56, 178);
    const rz = await sharp(raw, { raw: { width: 56, height: 178, channels: 4 } })
      .resize({ height: 104, fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true });
    blit(rz.data, rz.info.width, rz.info.height, k, 3);
  }

  // Row 4: Male Teacher (12 angles with brown vest, tie, slacks, glasses)
  console.log('Extracting Row 4: Male Teacher...');
  for (let k = 0; k < 12; k++) {
    const raw = extractSprite(teacher.data, teacher.info.width, teacher.info.height, stdCenters[k], 98, 56, 166);
    const rz = await sharp(raw, { raw: { width: 56, height: 166, channels: 4 } })
      .resize({ height: 108, fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true });
    blit(rz.data, rz.info.width, rz.info.height, k, 4);
  }

  // Row 5: Female Teacher (12 angles with navy blazer, blouse, skirt, bun, glasses)
  console.log('Extracting Row 5: Female Teacher...');
  for (let k = 0; k < 12; k++) {
    const raw = extractSprite(teacher.data, teacher.info.width, teacher.info.height, stdCenters[k], 342, 56, 178);
    const rz = await sharp(raw, { raw: { width: 56, height: 178, channels: 4 } })
      .resize({ height: 104, fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true });
    blit(rz.data, rz.info.width, rz.info.height, k, 5);
  }

  await sharp(atlasBuf, { raw: { width: atlasW, height: atlasH, channels: 4 } })
    .png()
    .toFile('public/sprites/uniform_atlas.png');

  console.log(`uniform_atlas.png built successfully! Size: ${atlasW} x ${atlasH} (12 cols x 6 rows)`);
}

buildAll();
