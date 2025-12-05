const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const assetsDir = path.join(__dirname, '..', 'assets');
    const files = fs
      .readdirSync(assetsDir)
      .filter((f) => f.startsWith('ferrari_frame_') && f.toLowerCase().endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (files.length === 0) {
      console.error('No ferrari_frame_*.png files found in', assetsDir);
      process.exit(1);
    }

    const imgs = await Promise.all(files.map((f) => Jimp.read(path.join(assetsDir, f))));
    const frameW = imgs[0].bitmap.width;
    const frameH = imgs[0].bitmap.height;
    const count = imgs.length;

    // create a vertical sheet (frames stacked top->bottom)
    const totalH = frameH * count;
    const sheet = new Jimp(frameW, totalH, 0x00000000);
    for (let i = 0; i < imgs.length; i++) {
      sheet.composite(imgs[i], 0, i * frameH);
    }

    // trim transparent columns that are empty across the whole sheet
    let left = 0;
    let right = sheet.bitmap.width - 1;
    const w = sheet.bitmap.width;
    const h = sheet.bitmap.height;
    // find leftmost non-empty column
    for (let x = 0; x < w; x++) {
      let colEmpty = true;
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        const alpha = sheet.bitmap.data[idx + 3];
        if (alpha !== 0) {
          colEmpty = false;
          break;
        }
      }
      if (!colEmpty) {
        left = x;
        break;
      }
    }
    // find rightmost non-empty column
    for (let x = w - 1; x >= 0; x--) {
      let colEmpty = true;
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        const alpha = sheet.bitmap.data[idx + 3];
        if (alpha !== 0) {
          colEmpty = false;
          break;
        }
      }
      if (!colEmpty) {
        right = x;
        break;
      }
    }

    const cropW = Math.max(1, right - left + 1);
    const cropped = sheet.clone().crop(left, 0, cropW, totalH);

    const outPath = path.join(assetsDir, 'ferrari_spritesheet_trimmed.png');
    await cropped.writeAsync(outPath);
    console.log('Wrote', outPath, `(${count} frames, frameH=${frameH}, croppedW=${cropW})`);
  } catch (err) {
    console.error('Error creating trimmed spritesheet:', err);
    process.exit(1);
  }
})();
