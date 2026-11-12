/* 生成方案B PWA 图标（纯 Node，无外部依赖）
   红色印章 + 白色内环 + 白色火焰（火/火山）图形
   输出 demo-b/icons/icon-180.png / icon-192.png / icon-512.png
*/
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ---------- PNG 编码 ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- 图形（SDF / 多边形） ---------- */

function sdRoundBox(nx, ny, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(nx - cx) - (halfW - r);
  const qy = Math.abs(ny - cy) - (halfH - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// 火焰多边形（归一化坐标，尖朝上）
const FLAME = [
  [0.5, 0.13],
  [0.545, 0.285],
  [0.615, 0.4],
  [0.655, 0.52],
  [0.645, 0.645],
  [0.585, 0.74],
  [0.52, 0.785],
  [0.5, 0.8],
  [0.48, 0.785],
  [0.415, 0.74],
  [0.355, 0.645],
  [0.345, 0.52],
  [0.385, 0.4],
  [0.455, 0.285]
];

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

const RED = [169, 52, 42]; // #a9342a
const CREAM = [246, 238, 220]; // #f6eedc

function render(size, ss) {
  const W = size * ss;
  const acc = new Float64Array(size * size * 4);
  const counts = new Float64Array(size * size);

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / W;

      let r = 0, g = 0, b = 0, a = 0;
      if (sdRoundBox(nx, ny, 0.5, 0.5, 0.47, 0.47, 0.165) <= 0) {
        r = RED[0]; g = RED[1]; b = RED[2]; a = 255;
      }
      // 白色内环（印章内圈）
      const ring = Math.abs(sdRoundBox(nx, ny, 0.5, 0.5, 0.4, 0.4, 0.135)) - 0.026;
      if (ring <= 0) {
        r = CREAM[0]; g = CREAM[1]; b = CREAM[2]; a = 255;
      }
      // 火焰
      if (pointInPoly(nx, ny, FLAME)) {
        r = CREAM[0]; g = CREAM[1]; b = CREAM[2]; a = 255;
      }

      const ox = Math.floor(x / ss);
      const oy = Math.floor(y / ss);
      const idx = (oy * size + ox) * 4;
      acc[idx] += r; acc[idx + 1] += g; acc[idx + 2] += b; acc[idx + 3] += a;
      counts[oy * size + ox] += 1;
    }
  }

  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const n = counts[i];
    // 预乘 alpha 平均，避免边缘出现黑边
    const ar = acc[i * 4], ag = acc[i * 4 + 1], ab = acc[i * 4 + 2], aa = acc[i * 4 + 3];
    const a = Math.round(aa / n);
    rgba[i * 4 + 3] = a;
    if (a > 0) {
      rgba[i * 4] = Math.round(ar / aa); // 预乘：/aa 恢复本色
      rgba[i * 4 + 1] = Math.round(ag / aa);
      rgba[i * 4 + 2] = Math.round(ab / aa);
    } else {
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
    }
  }
  return encodePNG(size, rgba);
}

const outDir = path.join(__dirname, "..", "demo-b", "icons");
fs.mkdirSync(outDir, { recursive: true });

[180, 192, 512].forEach((size) => {
  const png = render(size, size >= 512 ? 3 : 3);
  const file = path.join(outDir, "icon-" + size + ".png");
  fs.writeFileSync(file, png);
  console.log("wrote", file, png.length, "bytes");
});
