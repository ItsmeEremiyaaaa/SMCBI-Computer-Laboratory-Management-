const sharp = require('sharp');
const fs = require('fs');

async function buildFinalAtlas() {
  const { data, info } = await sharp('public/student-spritesheet.jpg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const bg = [161, 161, 161];

  function extractClean(cx, y0, targetW, targetH, minY = 0, maxY = 999) {
    const x0 = Math.round(cx - targetW / 2);
    const tw = targetW, th = targetH;
    const rgba = Buffer.alloc(tw * th * 4);
    
    const isBg = new Uint8Array(tw * th);
    for (let y = 0; y < th; y++) {
      const sy = Math.max(0, Math.min(h - 1, y0 + y));
      for (let x = 0; x < tw; x++) {
        const sx = Math.max(0, Math.min(w - 1, x0 + x));
        const pIdx = y * tw + x;
        if (sy < minY || sy > maxY) {
          isBg[pIdx] = 1;
          continue;
        }
        const sIdx = (sy * w + sx) * 3;
        const r = data[sIdx], g = data[sIdx+1], b = data[sIdx+2];
        const dist = Math.sqrt((r - bg[0])**2 + (g - bg[1])**2 + (b - bg[2])**2);
        if (dist <= 22) {
          isBg[pIdx] = 1;
        } else if (dist <= 30) {
          isBg[pIdx] = 2;
        } else {
          isBg[pIdx] = 0;
        }
      }
    }

    const visited = new Uint8Array(tw * th);
    const queue = [];
    for (let x = 0; x < tw; x++) {
      if (isBg[x] !== 0) { queue.push(x); visited[x] = 1; }
      const bIdx = (th - 1) * tw + x;
      if (isBg[bIdx] !== 0) { queue.push(bIdx); visited[bIdx] = 1; }
    }
    for (let y = 0; y < th; y++) {
      const lIdx = y * tw;
      if (isBg[lIdx] !== 0) { queue.push(lIdx); visited[lIdx] = 1; }
      const rIdx = y * tw + (tw - 1);
      if (isBg[rIdx] !== 0) { queue.push(rIdx); visited[rIdx] = 1; }
    }

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cy = Math.floor(curr / tw);
      const cx = curr % tw;
      
      const neighbors = [
        [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < tw && ny >= 0 && ny < th) {
          const nIdx = ny * tw + nx;
          if (!visited[nIdx] && isBg[nIdx] !== 0) {
            visited[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }

    for (let y = 1; y < th - 1; y++) {
      for (let x = 1; x < tw - 1; x++) {
        const pIdx = y * tw + x;
        if (!visited[pIdx]) {
          let vCount = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (visited[(y + dy) * tw + (x + dx)]) vCount++;
            }
          }
          if (vCount >= 6) {
            visited[pIdx] = 1;
            isBg[pIdx] = 1;
          }
        }
      }
    }

    for (let y = 0; y < th; y++) {
      const sy = Math.max(0, Math.min(h - 1, y0 + y));
      for (let x = 0; x < tw; x++) {
        const sx = Math.max(0, Math.min(w - 1, x0 + x));
        const sIdx = (sy * w + sx) * 3;
        const dIdx = (y * tw + x) * 4;
        const pIdx = y * tw + x;
        const r = data[sIdx], g = data[sIdx+1], b = data[sIdx+2];

        rgba[dIdx] = r;
        rgba[dIdx + 1] = g;
        rgba[dIdx + 2] = b;

        if (visited[pIdx] || sy < minY || sy > maxY) {
          if (isBg[pIdx] === 1 || sy < minY || sy > maxY) {
            rgba[dIdx + 3] = 0;
          } else {
            const dist = Math.sqrt((r - bg[0])**2 + (g - bg[1])**2 + (b - bg[2])**2);
            rgba[dIdx + 3] = Math.max(0, Math.min(255, Math.round(((dist - 22) / 8) * 255)));
          }
        } else {
          rgba[dIdx + 3] = 255;
        }
      }
    }
    return rgba;
  }

  const cellW = 64;
  const cellH = 96;
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

  // Row 0: Male Sit & Interact (12 angles from S to ENE)
  console.log('Row 0: Male Sit & Interact...');
  for (let k = 0; k < 12; k++) {
    const cx = Math.round(62 + k * 82.3);
    const buf = extractClean(cx, 396, 52, 74, 396, 470);
    blit(buf, 52, 74, k, 0);
  }

  // Row 1: Female Sit & Interact (12 angles from S to ENE)
  console.log('Row 1: Female Sit & Interact...');
  for (let k = 0; k < 12; k++) {
    const cx = Math.round(62 + k * 82.3);
    const buf = extractClean(cx, 485, 52, 76, 485, 560);
    blit(buf, 52, 76, k, 1);
  }

  // Row 2: Male Sitting side/back views (Row 3 in sheet: y=166..216, cols 5..11 + cols 0..4)
  console.log('Row 2: Male Sitting alternate angles...');
  for (let k = 0; k < 12; k++) {
    const cx = Math.round(62 + k * 82.3);
    const buf = extractClean(cx, 166, 52, 52, 166, 216);
    blit(buf, 52, 52, k, 2);
  }

  // Row 3: Female Sitting back views (Row 6 in sheet: y=318..378)
  console.log('Row 3: Female Sitting back views...');
  for (let k = 0; k < 12; k++) {
    const cx = Math.round(62 + k * 82.3);
    const buf = extractClean(cx, 318, 52, 60, 318, 378);
    blit(buf, 52, 60, k, 3);
  }

  // Row 4: Walk cycles
  console.log('Row 4: Walk cycles...');
  for (let k = 0; k < 6; k++) {
    const cx = Math.round(62 + k * 82.3);
    const buf = extractClean(cx, 22, 50, 68, 22, 85);
    blit(buf, 50, 68, k, 4);
  }
  for (let k = 0; k < 6; k++) {
    const cx = Math.round(62 + k * 82.3);
    const buf = extractClean(cx, 244, 50, 68, 244, 310);
    blit(buf, 50, 68, k + 6, 4);
  }

  // Row 5: Clean Teachers
  console.log('Row 5: Clean Teachers...');
  if (fs.existsSync('public/sprites/teacher_male_clean.png')) {
    const { data: tmData, info: tmInfo } = await sharp('public/sprites/teacher_male_clean.png').raw().toBuffer({ resolveWithObject: true });
    blit(tmData, tmInfo.width, tmInfo.height, 0, 5);
  }
  if (fs.existsSync('public/sprites/teacher_female_clean.png')) {
    const { data: tfData, info: tfInfo } = await sharp('public/sprites/teacher_female_clean.png').raw().toBuffer({ resolveWithObject: true });
    blit(tfData, tfInfo.width, tfInfo.height, 1, 5);
  }

  await sharp(atlasBuf, { raw: { width: atlasW, height: atlasH, channels: 4 } })
    .png()
    .toFile('public/sprites/uniform_atlas.png');

  console.log('Final uniform_atlas.png generated successfully!');
}

buildFinalAtlas();
