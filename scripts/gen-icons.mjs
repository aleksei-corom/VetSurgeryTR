// VetSurgeryTR — Generador de iconos para Tauri (run con bun/node + sharp).
// Uso: node scripts/gen-icons.mjs   (requiere `npm i -D sharp` o bun add -d sharp)
// Fuente: public/icon.png (logo 512+). Genera:
//   src-tauri/icons/32x32.png, 128x128.png, 128x128@2x.png (256), icon.png (512)
//   src-tauri/icons/icon.ico — ICO con un PNG de 256x256 embebido (Vista+,
//   aceptado por Windows y por el bundler NSIS de Tauri).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "public", "icon.png");
const outDir = path.join(root, "src-tauri", "icons");

await mkdir(outDir, { recursive: true });

async function renderPng(size, file) {
  const buf = await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(path.join(outDir, file), buf);
  return buf;
}

const png32 = await renderPng(32, "32x32.png");
await renderPng(128, "128x128.png");
const png256 = await renderPng(256, "128x128@2x.png");
await renderPng(512, "icon.png");

// ---------------- ICO con PNG embebido (256x256) ----------------
// ICONDIR (6 bytes)  : reserved=0, type=1 (icono), count=1
// ICONDIRENTRY (16 b): width=0 (→256), height=0 (→256), colorCount=0,
//                      reserved=0, planes=1, bitCount=32,
//                      bytesInRes=tamaño del PNG, imageOffset=6+16=22
const png = png256;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icono
header.writeUInt16LE(1, 4); // número de imágenes
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // ancho 0 = 256 px
entry.writeUInt8(0, 1); // alto 0 = 256 px
entry.writeUInt8(0, 2); // paleta
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planos
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png.length, 8); // bytes del recurso PNG
entry.writeUInt32LE(22, 12); // offset de los datos (6 + 16)
const ico = Buffer.concat([header, entry, png]);
await writeFile(path.join(outDir, "icon.ico"), ico);

// Copia también el PNG de 32 para referencia (favicon ya está en public/).
console.log(
  `Iconos generados en ${outDir}: 32x32.png (${png32.length} B), 128x128.png, ` +
    `128x128@2x.png, icon.png (512), icon.ico (${ico.length} B, PNG embebido 256)`
);
