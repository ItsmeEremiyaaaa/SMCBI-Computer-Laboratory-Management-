const sharp = require('sharp');
const fs = require('fs');

async function buildUniformAtlas() {
  const cellW = 64;
  const cellH = 96;
  const cols = 11;
  const rows = 7;
  const atlasW = cols * cellW;
  const atlasH = rows * cellH;
  
  const atlasBuf = Buffer.alloc(atlasW * atlasH * 4); // all transparent zeros
  
  const categories = [
    'male_walk',
    'female_walk',
    'male_sit',
    'female_sit',
    'male_laptop',
    'female_laptop'
  ];
  
  for (let r = 0; r < categories.length; r++) {
    const cat = categories[r];
    for (let c = 0; c < 11; c++) {
      const file = `public/sprites/${cat}_${c}.png`;
      if (!fs.existsSync(file)) continue;
      const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
      
      const destX0 = c * cellW + Math.floor((cellW - info.width) / 2);
      const destY0 = r * cellH + (cellH - info.height - 2); // anchor to bottom
      
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const dx = destX0 + x;
          const dy = destY0 + y;
          if (dx >= 0 && dx < atlasW && dy >= 0 && dy < atlasH) {
            const sIdx = (y * info.width + x) * 4;
            const dIdx = (dy * atlasW + dx) * 4;
            atlasBuf[dIdx] = data[sIdx];
            atlasBuf[dIdx + 1] = data[sIdx + 1];
            atlasBuf[dIdx + 2] = data[sIdx + 2];
            atlasBuf[dIdx + 3] = data[sIdx + 3];
          }
        }
      }
    }
  }
  
  // Row 6: Teachers
  const teachers = [
    { file: 'public/sprites/teacher_male.png', col: 0 },
    { file: 'public/sprites/teacher_female.png', col: 1 }
  ];
  for (const t of teachers) {
    if (fs.existsSync(t.file)) {
      const { data, info } = await sharp(t.file).raw().toBuffer({ resolveWithObject: true });
      const destX0 = t.col * cellW + Math.floor((cellW - info.width) / 2);
      const destY0 = 6 * cellH + (cellH - info.height - 2);
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const dx = destX0 + x;
          const dy = destY0 + y;
          if (dx >= 0 && dx < atlasW && dy >= 0 && dy < atlasH) {
            const sIdx = (y * info.width + x) * 4;
            const dIdx = (dy * atlasW + dx) * 4;
            atlasBuf[dIdx] = data[sIdx];
            atlasBuf[dIdx + 1] = data[sIdx + 1];
            atlasBuf[dIdx + 2] = data[sIdx + 2];
            atlasBuf[dIdx + 3] = data[sIdx + 3];
          }
        }
      }
    }
  }
  
  await sharp(atlasBuf, { raw: { width: atlasW, height: atlasH, channels: 4 } })
    .png()
    .toFile('public/sprites/uniform_atlas.png');
    
  console.log('uniform_atlas.png built successfully! Size:', atlasW, 'x', atlasH);
}

buildUniformAtlas();
