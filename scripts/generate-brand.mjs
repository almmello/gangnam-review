import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";
import opentype from "opentype.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = path.join(root, "public");
await mkdir(path.join(publicDir, "brand"), { recursive: true });
await mkdir(path.join(publicDir, "licenses"), { recursive: true });
async function font(packageName, file) {
  const bytes = await readFile(path.join(root, "node_modules", "@fontsource", packageName, "files", file));
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const serif = await font("dm-serif-display", "dm-serif-display-latin-400-normal.woff");
const hero = await font("cormorant-garamond", "cormorant-garamond-latin-500-normal.woff");
const italic = await font("cormorant-garamond", "cormorant-garamond-latin-500-italic.woff");
const sans = await font("manrope", "manrope-latin-600-normal.woff");
const accent = "#C9356E", ink = "#1A1A2E";
const outline = (face, text, x, y, size, color) => { const p = face.getPath(text, x, y, size); p.fill = color; return p.toSVG(2); };
const symbol = (background = accent, foreground = "white") => `<rect width="64" height="64" rx="18" fill="${background}"/><path d="M29 22a12 12 0 1 0 0 20V32h-8M37 44V20h5c12 0 12 14 0 14h-5m7 0 9 10" fill="none" stroke="${foreground}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const icon = svg(64, 64, symbol());
await writeFile(path.join(publicDir, "favicon.svg"), icon);
await writeFile(path.join(publicDir, "brand/symbol.svg"), icon);
await writeFile(path.join(publicDir, "brand/symbol-dark.svg"), svg(64,64,symbol("white",accent)));
function wordmark(dark = false) {
  const x = 82, y = 43, size = 37;
  const first = outline(serif, "gangnam", x, y, size, dark ? "white" : ink);
  const second = outline(serif, "review", x + serif.getAdvanceWidth("gangnam",size) + 5,y,size,dark ? "#F9B6CE" : accent);
  return svg(370,76,`<g transform="translate(0 6)">${symbol(dark ? "white" : accent,dark ? accent : "white")}</g>${first}${second}${outline(sans,"REVIEW QUALITY WORKBENCH",84,64,9,dark ? "#E7D7DF" : "#62616C")}`);
}
await writeFile(path.join(publicDir,"brand/wordmark.svg"), wordmark());
await writeFile(path.join(publicDir,"brand/wordmark-dark.svg"), wordmark(true));
await sharp(Buffer.from(icon)).resize(180,180).png().toFile(path.join(publicDir,"apple-touch-icon.png"));
const png32 = await sharp(Buffer.from(icon)).resize(32,32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
header[6] = 32; header[7] = 32;
header.writeUInt16LE(1,10); header.writeUInt16LE(32,12);
header.writeUInt32LE(png32.length,14); header.writeUInt32LE(22,18);
await writeFile(path.join(publicDir,"favicon.ico"), Buffer.concat([header,png32]));
const og = svg(1200,630,`<rect width="1200" height="630" fill="#FFF5F6"/>
<rect x="0" y="0" width="1200" height="8" fill="${accent}"/>
<g transform="translate(70 58) scale(.76)">${symbol()}</g>
${outline(serif,"gangnam review",134,94,32,ink)}
${outline(sans,"THE EVIDENCE, IN FOCUS",74,188,13,"#A02555")}
${outline(hero,"A clearer view of",68,295,91,ink)}
${outline(italic,"every review.",68,391,98,accent)}
<text x="74" y="452" font-family="Arial, sans-serif" font-size="20" fill="#62616C">Discover the sources. Examine the evidence.</text>
<circle cx="987" cy="290" r="128" fill="none" stroke="#EFD2DD" stroke-width="1"/>
<circle cx="987" cy="290" r="100" fill="none" stroke="#EFD2DD" stroke-width="1"/>
<g transform="translate(919 222) scale(2.125)">${symbol()}</g>
<path d="M74 501H1126" stroke="#E8CBD6"/>
${outline(sans,"Missing information",74,543,17,ink)}
<circle cx="300" cy="537" r="3" fill="${accent}"/>
${outline(sans,"Clinic identity",328,543,17,ink)}
<circle cx="492" cy="537" r="3" fill="${accent}"/>
${outline(sans,"Review similarity",520,543,17,ink)}
${outline(sans,"gangnam-review.vercel.app",74,594,12,"#7D6973")}
${outline(sans,"INDEPENDENT PROTOTYPE",908,594,10,"#7D6973")}`);
await writeFile(path.join(publicDir,"brand/og-source.svg"),og);
await sharp(Buffer.from(og)).png().toFile(path.join(publicDir,"og.png"));
for (const name of ["manrope","cormorant-garamond","dm-serif-display"]) {
  await copyFile(path.join(root,"node_modules/@fontsource",name,"LICENSE"),path.join(publicDir,"licenses",name+".txt"));
}
console.log("Brand assets generated: SVG wordmarks/symbols, SVG + ICO favicon, Apple icon, 1200x630 OG PNG and font licenses.");
