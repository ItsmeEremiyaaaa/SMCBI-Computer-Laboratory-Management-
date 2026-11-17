const sharp = require('sharp');
const fs = require('fs');

async function extractAllSprites() {
  const { data, info } = await sharp('public/student-spritesheet.jpg').raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  
  function isFg(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const idx = (y * w + x) * 3;
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    const dr = r - 215, dg = g - 215, db = b - 215;
    return Math.sqrt(dr*dr + dg*dg + db*db) > 18;
  }
  
  const categories = [
    { name: 'male_walk', y0: 20, y1: 106, targetW: 56, targetH: 92 },
    { name: 'female_walk', y0: 120, y1: 204, targetW: 56, targetH: 92 },
    { name: 'male_sit', y0: 214, y1: 296, targetW: 56, targetH: 88 },
    { name: 'female_sit', y0: 304, y1: 384, targetW: 56, targetH: 88 },
    { name: 'male_laptop', y0: 385, y1: 473, targetW: 64, targetH: 92 },
    { name: 'female_laptop', y0: 476, y1: 565, targetW: 64, targetH: 92 }
  ];

  if (!fs.existsSync('public/sprites')) {
    fs.mkdirSync('public/sprites', { recursive: true });
  }
  
  for (const cat of categories) {
    const colCount = new Array(w).fill(0);
    for (let x = 110; x < w; x++) {
      for (let y = cat.y0; y < cat.y1; y++) {
        if (isFg(x, y)) colCount[x]++;
      }
    }
    const cols = [];
    let inCol = false, startX = 0;
    for (let x = 110; x < w; x++) {
      if (colCount[x] > 2 && !inCol) {
        inCol = true; startX = x;
      } else if (colCount[x] <= 2 && inCol) {
        inCol = false;
        if (x - startX > 8) cols.push({ x0: startX, x1: x });
      }
    }
    if (inCol && w - startX > 8) cols.push({ x0: startX, x1: w });
    
    console.log(cat.name, 'found frames:', cols.length);
    
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      let topY = cat.y1, botY = cat.y0;
      for (let y = cat.y0; y < cat.y1; y++) {
        for (let x = col.x0; x < col.x1; x++) {
          if (isFg(x, y)) {
            if (y < topY) topY = y;
            if (y > botY) botY = y;
          }
        }
      }
      
      const charW = col.x1 - col.x0;
      const charH = botY - topY + 1;
      const centerX = Math.floor((col.x0 + col.x1) / 2);
      
      const tw = cat.targetW, th = cat.targetH;
      const rgba = Buffer.alloc(tw * th * 4);
      
      const destFootY = th - 2;
      const destCenterX = Math.floor(tw / 2);
      
      for (let sy = topY; sy <= botY; sy++) {
        for (let sx = col.x0; sx < col.x1; sx++) {
          const dx = destCenterX + (sx - centerX);
          const dy = destFootY - (botY - sy);
          
          if (dx >= 0 && dx < tw && dy >= 0 && dy < th) {
            const sIdx = (sy * w + sx) * 3;
            const dIdx = (dy * tw + dx) * 4;
            
            const r = data[sIdx], g = data[sIdx+1], b = data[sIdx+2];
            const dr = r - 215, dg = g - 215, db = b - 215;
            const dist = Math.sqrt(dr*dr + dg*dg + db*db);
            
            rgba[dIdx] = r;
            rgba[dIdx + 1] = g;
            rgba[dIdx + 2] = b;
            
            if (dist < 13) {
              rgba[dIdx + 3] = 0;
            } else if (dist < 23) {
              rgba[dIdx + 3] = Math.round(((dist - 13) / 10) * 255);
            } else {
              rgba[dIdx + 3] = 255;
            }
          }
        }
      }
      
      const filename = `public/sprites/${cat.name}_${i}.png`;
      await sharp(rgba, { raw: { width: tw, height: th, channels: 4 } }).png().toFile(filename);
    }
  }
  console.log('Finished extracting all 66 sprites!');
}

extractAllSprites();
