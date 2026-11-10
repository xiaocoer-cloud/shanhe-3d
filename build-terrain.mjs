import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const Z = 5, N = 2 ** Z;
const X0 = 20, X1 = 29, Y0 = 9, Y1 = 15;
const MW = (X1 - X0 + 1) * 256, MH = (Y1 - Y0 + 1) * 256;
const CACHE = path.join(ROOT, '.cache/terr');

function tileLat(y) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / N))) * 180 / Math.PI; }
const WEST = X0 / N * 360 - 180;
const EAST = (X1 + 1) / N * 360 - 180;
const NORTH = tileLat(Y0);
const SOUTH = tileLat(Y1 + 1);
const OW = 2048;
const OH = Math.round(OW * (NORTH - SOUTH) / (EAST - WEST));

async function download(x, y) {
  const file = path.join(CACHE, `${Z}_${x}_${y}.png`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tile ${x},${y}: ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

const mosaic = Buffer.alloc(MW * MH * 3);
let done = 0;
for (let ty = Y0; ty <= Y1; ty++) {
  for (let tx = X0; tx <= X1; tx++) {
    const file = await download(tx, ty);
    const raw = await sharp(file).removeAlpha().raw().toBuffer();
    const ox = (tx - X0) * 256, oy = (ty - Y0) * 256;
    for (let y = 0; y < 256; y++) {
      const src = y * 256 * 3;
      const dst = ((oy + y) * MW + ox) * 3;
      raw.copy(mosaic, dst, src, src + 256 * 3);
    }
    done++;
    process.stdout.write(`\r${done}/${(X1-X0+1)*(Y1-Y0+1)} tiles`);
  }
}
console.log('\nstitched', MW, MH, '-> equirect', OW, OH);

const elev = new Float32Array(OW * OH);
const n256 = N * 256;
function merc(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); }
for (let y = 0; y < OH; y++) {
  const lat = NORTH - (y + 0.5) / OH * (NORTH - SOUTH);
  const gy = (1 - merc(lat) / Math.PI) / 2 * n256 - Y0 * 256;
  const sy = Math.min(MH - 1, Math.max(0, Math.floor(gy)));
  for (let x = 0; x < OW; x++) {
    const lon = WEST + (x + 0.5) / OW * (EAST - WEST);
    const gx = (lon + 180) / 360 * n256 - X0 * 256;
    const sx = Math.min(MW - 1, Math.max(0, Math.floor(gx)));
    const i = (sy * MW + sx) * 3;
    elev[y * OW + x] = (mosaic[i] * 256 + mosaic[i + 1] + mosaic[i + 2] / 256) - 32768;
  }
}

const out = Buffer.alloc(OW * OH * 3);
const cosLat = Math.cos(((NORTH + SOUTH) / 2) * Math.PI / 180);
// meters per pixel in dest grid
const mPerPxX = (EAST - WEST) * 111320 * cosLat / OW;
const mPerPxY = (NORTH - SOUTH) * 111320 / OH;
// light from NW, 42 deg altitude
const az = 315 * Math.PI / 180, alt = 42 * Math.PI / 180;
const lx = Math.cos(alt) * Math.sin(az), ly = Math.cos(alt) * Math.cos(az), lz = Math.sin(alt);

for (let y = 0; y < OH; y++) {
  for (let x = 0; x < OW; x++) {
    const i = y * OW + x;
    const e = elev[i];
    const xl = x > 0 ? i - 1 : i, xr = x < OW - 1 ? i + 1 : i;
    const yu = y > 0 ? i - OW : i, yd = y < OH - 1 ? i + OW : i;
    const dx = (elev[xr] - elev[xl]) / (2 * mPerPxX);
    const dy = (elev[yd] - elev[yu]) / (2 * mPerPxY);
    // normal = (-dx, -dy, 1) normalized; light dot
    const len = Math.sqrt(dx * dx + dy * dy + 1);
    const ndl = (-dx * lx - dy * ly + lz) / len;
    const shade = Math.max(0.3, Math.min(1.16, 0.38 + 0.82 * ndl));
    const slope = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2.2);

    let r, g, b;
    if (e < 0) {
      r = 5; g = 12; b = 9;
    } else if (e < 300) {
      r = 27; g = 44; b = 34;
    } else if (e < 1200) {
      r = 39; g = 54; b = 40;
    } else if (e < 2600) {
      r = 58; g = 66; b = 49;
    } else if (e < 4200) {
      r = 82; g = 82; b = 63;
    } else {
      r = 108; g = 104; b = 84;
    }
    const snow = e > 4800 ? Math.min(1, (e - 4800) / 1200) : 0;
    r = r * (1 - snow) + 118 * snow;
    g = g * (1 - snow) + 116 * snow;
    b = b * (1 - snow) + 96 * snow;
    const s = shade * (1 - slope * 0.16);
    out[i * 3] = Math.min(255, r * s);
    out[i * 3 + 1] = Math.min(255, g * s);
    out[i * 3 + 2] = Math.min(255, b * s);
  }
}

await sharp(out, { raw: { width: OW, height: OH, channels: 3 } })
  .jpeg({ quality: 78, mozjpeg: true })
  .toFile(path.join(ROOT, 'assets/terrain.jpg'));

fs.writeFileSync(path.join(ROOT, 'assets/terrain-meta.json'), JSON.stringify({ west: WEST, east: EAST, south: SOUTH, north: NORTH, width: OW, height: OH }, null, 2));
console.log('terrain.jpg', (fs.statSync(path.join(ROOT, 'assets/terrain.jpg')).size / 1024).toFixed(0), 'KB');
