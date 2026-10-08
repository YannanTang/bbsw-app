// Builds every app icon from public/bbsw-logo.webp: the bridges on top, a large "BBSW",
// and "2026" underneath, on white. Run with `node scripts/generate-icons.mjs`.
// "2026" is set in Avenir Next Bold, which ships with macOS; on other systems the
// renderer falls back to another font, so regenerate on a Mac.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const logo = join(publicDir, "bbsw-logo.webp");

const SIZE = 512;
const RADIUS = 114; // only for app-icon-rounded.png; phones round the other icons themselves
const SECOND_B = "#2b2b2b"; // the logo's second "B" is white, which disappears on a white icon
const YEAR_COLOR = "#0eb4c7"; // the logo's teal
const YEAR_FONT = "Avenir Next";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Recolors the white second "B" (logo pixels x 205–370, y 540–800) to SECOND_B. Edge pixels
// that blend white with the neighboring red B or teal S keep the same blend with the new color.
async function logoWithDarkB() {
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const target = hex(SECOND_B);
  for (let y = 540; y < 800; y++) {
    for (let x = 205; x <= 370; x++) {
      const i = (y * info.width + x) * 4;
      const whiteness = Math.max(0, Math.min(1, (Math.min(data[i], data[i + 1], data[i + 2]) - 20) / 235));
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + whiteness * (target[c] - 255));
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

// The square artwork at SIZE x SIZE. `scale` shrinks the content (not the canvas) for maskable icons.
async function artwork(scale = 1) {
  const source = await logoWithDarkB();
  const crop = async (region, width) => {
    const part = await sharp(source).extract(region).png().toBuffer();
    const out = await sharp(part).resize(Math.round(width * scale)).toBuffer();
    return { input: out, ...(await sharp(out).metadata()) };
  };
  const bridge = await crop({ left: 325, top: 140, width: 1285, height: 395 }, 400);
  const word = await crop({ left: 85, top: 550, width: 590, height: 235 }, 380);
  const yearHeight = 62 * scale;
  const gap1 = 22 * scale;
  const gap2 = 26 * scale;
  const top = Math.round((SIZE - (bridge.height + gap1 + word.height + gap2 + yearHeight)) / 2);
  const yearBaseline = Math.round(top + bridge.height + gap1 + word.height + gap2 + yearHeight);
  const year = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="${SIZE / 2}" y="${yearBaseline}" text-anchor="middle" font-family="${YEAR_FONT}" font-weight="bold" ` +
      `font-size="${Math.round(yearHeight / 0.72)}" letter-spacing="${Math.round(30 * scale)}" fill="${YEAR_COLOR}">2026</text></svg>`
  );
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: "#ffffff" } })
    .composite([
      { input: bridge.input, left: Math.round((SIZE - bridge.width) / 2), top },
      { input: word.input, left: Math.round((SIZE - word.width) / 2), top: Math.round(top + bridge.height + gap1) },
      { input: year },
    ])
    .png()
    .toBuffer();
}

const square = await artwork();
// Maskable icons can be cropped to a circle, so the content must sit inside the central 80%.
const maskable = await artwork(0.78);

const rounded = await sharp(square)
  .composite([
    { input: Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="#fff"/></svg>`), blend: "dest-in" },
    { input: Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><rect x="2" y="2" width="${SIZE - 4}" height="${SIZE - 4}" rx="${RADIUS - 2}" fill="none" stroke="#e3e3e3" stroke-width="4"/></svg>`) },
  ])
  .png()
  .toBuffer();

const renders = [
  { image: square, size: 192, out: "icon-192.png" },
  { image: square, size: 512, out: "icon-512.png" },
  { image: square, size: 180, out: "apple-touch-icon.png", flatten: true },
  { image: maskable, size: 512, out: "icon-maskable-512.png" },
  // For linking to the app from other sites (bbsw.org): rounded corners and a light edge built in.
  { image: rounded, size: 512, out: "app-icon-rounded.png" },
];

for (const { image, size, out, flatten } of renders) {
  let pipeline = sharp(image).resize(size, size);
  if (flatten) pipeline = pipeline.flatten({ background: "#ffffff" }); // iOS shows transparency as black
  await pipeline.png().toFile(join(publicDir, out));
  console.log(`✓ ${out} (${size}x${size})`);
}
