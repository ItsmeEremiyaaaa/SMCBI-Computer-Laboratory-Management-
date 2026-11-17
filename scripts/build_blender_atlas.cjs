const sharp = require('sharp');
const fs = require('fs');

const imgPath = 'C:/Users/maria/.gemini/antigravity/brain/81edcee1-b032-4295-8f6c-fdf7e281df89/.user_uploaded/media_1794902447167_ecdd8b8f.jpg';

async function buildBlenderAtlas() {
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;

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

  function extractCharSprite(cx, yTop, targetW, targetH) {
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
        const r = data[sIdx], g = data[sIdx+1], b = data[sIdx+2];

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

  // Column centers for the 12 angles (0° to 330° in 30° increments)
  const maleCenters = [95, 178, 255, 332, 410, 486, 563, 639, 716, 794, 875, 952];
  const femCenters  = [94, 176, 253, 331, 409, 487, 564, 637, 715, 794, 871, 950];

  // Atlas: 12 columns x 4 rows
  // Cell: 64 wide x 112 tall
  // Row 0: Male 12 angles (0° to 330°)
  // Row 1: Female 12 angles (0° to 330°)
  // Row 2: Teachers (col 0: male teacher, col 1: female teacher)
  // Row 3: Spare
  const cellW = 64;
  const cellH = 112;
  const cols = 12;
  const rows = 4;
  const atlasW = cols * cellW;
  const atlasH = rows * cellH;
  const atlasBuf = Buffer.alloc(atlasW * atlasH * 4); // all transparent zeros

  function blit(spriteBuf, sw, sh, col, row) {
    const destX0 = col * cellW + Math.floor((cellW - sw) / 2);
    const destY0 = row * cellH + (cellH - sh - 2); // anchor to bottom
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

  // Row 0: Male 12 angles (y=97 to 261 -> h=164)
  console.log('Extracting Male 12 angles...');
  for (let k = 0; k < 12; k++) {
    const rawSprite = extractCharSprite(maleCenters[k], 97, 56, 164);
    const resized = await sharp(rawSprite, { raw: { width: 56, height: 164, channels: 4 } })
      .resize({ height: 106, fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    blit(resized.data, resized.info.width, resized.info.height, k, 0);
  }

  // Row 1: Female 12 angles (y=344 to 522 -> h=178)
  console.log('Extracting Female 12 angles...');
  for (let k = 0; k < 12; k++) {
    const rawSprite = extractCharSprite(femCenters[k], 344, 56, 178);
    const resized = await sharp(rawSprite, { raw: { width: 56, height: 178, channels: 4 } })
      .resize({ height: 104, fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    blit(resized.data, resized.info.width, resized.info.height, k, 1);
  }

  // Row 2: Teachers at the whiteboard
  console.log('Extracting Row 2: Teachers...');
  if (fs.existsSync('public/sprites/teacher_male_clean.png')) {
    const tm = await sharp('public/sprites/teacher_male_clean.png')
      .resize({ height: 108, fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    blit(tm.data, tm.info.width, tm.info.height, 0, 2);
  }
  if (fs.existsSync('public/sprites/teacher_female_clean.png')) {
    const tf = await sharp('public/sprites/teacher_female_clean.png')
      .resize({ height: 104, fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    blit(tf.data, tf.info.width, tf.info.height, 1, 2);
  }

  await sharp(atlasBuf, { raw: { width: atlasW, height: atlasH, channels: 4 } })
    .png()
    .toFile('public/sprites/uniform_atlas.png');

  console.log(`uniform_atlas.png built successfully! Size: ${atlasW} x ${atlasH} (12 cols x 4 rows)`);
}

buildBlenderAtlas();
