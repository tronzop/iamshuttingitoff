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
    const totalW = frameW * imgs.length;

    const out = new Jimp(totalW, frameH, 0x00000000);
    for (let i = 0; i < imgs.length; i++) {
      out.composite(imgs[i], i * frameW, 0);
    }

    const outPath = path.join(assetsDir, 'ferrari_spritesheet.png');
    await out.writeAsync(outPath);
    console.log('Wrote', outPath, `(${imgs.length} frames, ${frameW}x${frameH} each)`);
  } catch (err) {
    console.error('Error creating spritesheet:', err);
    process.exit(1);
  }
})();
