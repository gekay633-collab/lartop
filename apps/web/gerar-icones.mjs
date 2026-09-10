import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#1F3524"/>
  <text x="256" y="330" font-family="Georgia, serif" font-size="280" font-weight="700" fill="#6FA33B" text-anchor="middle">L</text>
</svg>
`;

async function main() {
  const buffer512 = await sharp(Buffer.from(svg)).resize(512, 512).png().toBuffer();
  writeFileSync('public/icon-512.png', buffer512);

  const buffer192 = await sharp(Buffer.from(svg)).resize(192, 192).png().toBuffer();
  writeFileSync('public/icon-192.png', buffer192);

  console.log('Icones gerados: icon-192.png e icon-512.png');
}

main();
