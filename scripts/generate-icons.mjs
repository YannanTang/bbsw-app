import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

const baseSvg = readFileSync(join(publicDir, "icon-source.svg"));
const maskableSvg = readFileSync(join(publicDir, "icon-maskable-source.svg"));

const renders = [
  { svg: baseSvg, size: 192, out: "icon-192.png" },
  { svg: baseSvg, size: 512, out: "icon-512.png" },
  { svg: baseSvg, size: 180, out: "apple-touch-icon.png" },
  { svg: maskableSvg, size: 512, out: "icon-maskable-512.png" },
];

for (const { svg, size, out } of renders) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, out));
  console.log(`✓ ${out} (${size}x${size})`);
}
