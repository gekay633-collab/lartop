import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

// Android notification badges must be a white glyph on transparency.
// The launcher icon remains the colored, square /icon-192.png.
const badge = "public/badge-notificacao-96.png";
const meta = await sharp(badge).metadata();
assert.equal(meta.format, "png");
assert.equal(meta.width, 96);
assert.equal(meta.height, 96);
assert.equal(meta.hasAlpha, true, "Notification badge must be transparent");

const { data, info } = await sharp(badge).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let transparent = 0;
let visible = 0;
for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2], alpha = data[i + 3];
  if (alpha === 0) transparent++;
  if (alpha > 220) {
    visible++;
    assert.ok(r > 240 && g > 240 && b > 240, "Badge glyph should be white");
  }
}
assert.ok(transparent > 1000, "Background must remain transparent");
assert.ok(visible > 300, "Badge cannot be a blank transparent image");

const worker = await readFile("public/sw.js", "utf8");
assert.match(worker, /icon:\s*"\/icon-192\.png"/);
assert.match(worker, /badge:\s*"\/badge-notificacao-96\.png"/);
console.log("Android notification badge PNG, transparency and service worker reference: OK");
