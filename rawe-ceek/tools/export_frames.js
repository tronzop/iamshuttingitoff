const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const srcPath = path.join(__dirname, '..', 'assets', 'ferrari f1.png');
    if (!fs.existsSync(srcPath)) {
      console.error('Source sprite not found:', srcPath);
      process.exit(1);
    }

    const img = await Jimp.read(srcPath);
    const w = img.bitmap.width;
    const h = img.bitmap.height;
    const outDir = path.join(__dirname, '..', 'assets');
    const count = 8;

    console.log(`Loaded ${srcPath} (${w}x${h}), generating ${count} frames...`);

    for (let i = 0; i < count; i++) {
      // compute subtle transform parameters
      const t = (i / count) * Math.PI * 2;
      const lean = Math.sin(t) * 3; // degrees
      const bob = Math.round(Math.sin(t + 0.5) * (h * 0.02));
      const scale = 1 + Math.sin(t + 1.2) * 0.02;

      // create a new image with same size and transparent background
      const frame = new Jimp(w, h, 0x00000000);

      // apply transformations by drawing the original onto a temporary canvas
      const tmp = img.clone();
      // scale
      tmp.scale(scale);
      // rotate around center
      tmp.rotate(lean, false);

      // composite centered with bob offset
      const dx = Math.round((w - tmp.bitmap.width) / 2);
      const dy = Math.round((h - tmp.bitmap.height) / 2 + bob);
      frame.composite(tmp, dx, dy);

      // remove near-white background from the composed frame: set alpha=0 for near-white pixels
      const data = frame.bitmap.data; // RGBA
      for (let px = 0; px < data.length; px += 4) {
        const r = data[px + 0];
        const g = data[px + 1];
        const b = data[px + 2];
        // distance from white (0 = white)
        const distFromWhite = 255 - r + (255 - g) + (255 - b);
        if (distFromWhite < 60) {
          data[px + 3] = 0;
        }
      }

      const outPath = path.join(outDir, `ferrari_frame_${i}.png`);
      await frame.writeAsync(outPath);
      console.log('Wrote', outPath);
    }

    console.log('Frame export complete.');
  } catch (err) {
    console.error('Error generating frames:', err);
    process.exit(1);
  }
})();
