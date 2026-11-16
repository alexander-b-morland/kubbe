// Generates the Kubbe logo: an ink line drawing of a carved wooden hand holding a trout.
//
//   node design/logo/generate.mjs            writes the SVGs next to this file and the app data module
//   node design/logo/generate.mjs --preview  also renders PNG previews
//   node design/logo/generate.mjs --icons    also renders the app icons into src/app and public/icons
//
// Coordinates are in a 560 x 556 drawing space. Layers are listed back to front.
import fs from 'node:fs';
import path from 'node:path';

const INK = '#1E2A44', PAPER = '#F5F4EF';
const VB = [-8, -2, 560, 556];
const TONE = { wood: '#E6CD9C', woodDark: '#D2A24C', nail: '#FCFBF7', fish: '#FCFBF7', back: '#9DB0BF', fin: '#7F98AA', shadow: '#DADFE2' };

// deterministic jitter so strokes look hand-drawn but stay stable between runs
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const f = (n) => Math.round(n * 10) / 10;

// polygon -> path with slightly bowed edges
function poly(pts, bow = 2.2) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const o = rnd() * 2 * bow * Math.min(1, len / 40);
    d += `Q${f((a[0] + b[0]) / 2 - dy / len * o)} ${f((a[1] + b[1]) / 2 + dx / len * o)} ${f(b[0])} ${f(b[1])}`;
  }
  return d + 'Z';
}
// parallel hatch lines filling a box; always clipped to a face when drawn
function hatch(x0, y0, x1, y1, gap = 7, slope = -0.55) {
  let d = '';
  const h = y1 - y0, pad = Math.abs(h * slope) + gap;
  for (let x = x0 - pad; x < x1 + pad; x += gap) {
    const j = rnd() * 1.6;
    d += `M${f(x + j)} ${f(y0 - 4)}L${f(x + j + (h + 8) * slope)} ${f(y1 + 4)}`;
  }
  return d;
}

// ---- layer model -------------------------------------------------------
// kind: shape (outlined, filled), line (stroke only), tint (flat colour, no stroke), ink (solid ink)
// clip: every detail is confined to the shape it belongs to, and optionally to one face of it
const layers = [];
const clips = [];
const clipId = (d) => { let i = clips.indexOf(d); if (i < 0) { clips.push(d); i = clips.length - 1; } return i; };
let P = { t: 0, step: 0.07, u: 0.5, n: 0 };
const phase = (t, step = 0.07, u = 0.5) => { P = { t, step, u, n: 0 }; };
const DETAIL_AT = 2.75;
const timing = (late) => late ? { t: f(DETAIL_AT + (rnd() + 0.5) * 0.3), u: 0.6 } : { t: f(P.t + (P.n++) * P.step), u: P.u };
const cl = (within) => (within ? [].concat(within).map(clipId) : []);

const shape = (d, w = 6.5, tone = 'wood') => { layers.push({ kind: 'shape', d, w, tone, clip: [], ...timing(false) }); return d; };
// a main line belongs to the structure; a detail line (grain, rays, hatching) arrives late
const line = (d, w, within) => layers.push({ kind: 'line', d, w, clip: cl(within), ...timing(false) });
const detail = (d, w, within) => layers.push({ kind: 'line', d, w, clip: cl(within), ...timing(true) });
const tint = (d, tone, within, tf) => layers.push({ kind: 'tint', d, w: 0, tone, clip: cl(within), tf, t: 3.05, u: 0.7 });
const ink = (d) => layers.push({ kind: 'ink', d, w: 0, clip: [], t: f(P.t + P.n * P.step), u: 0.2 });
// shade one face: darker tone plus hatching, both confined to that face of the shape
const shadeFace = (shapeD, faceD, tone, hatchD, w = 2.4) => { if (tone) tint(faceD, tone, shapeD); detail(hatchD, w, [shapeD, faceD]); };

// ---- shapes that are referenced more than once --------------------------
const FISH = 'M508 20C484 18 442 36 410 58C380 76 346 92 315 108C270 135 214 190 170 250C150 280 126 330 108 372C80 384 44 400 12 420C46 426 76 432 98 446C108 470 116 496 126 520C140 482 152 446 166 412C200 392 250 365 300 330C345 298 380 262 405 225C426 196 440 170 454 150C474 136 506 104 534 50C520 54 506 60 496 66C500 54 506 44 512 34C515 28 513 22 508 20Z';
const TAIL = 'M108 372C80 384 44 400 12 420C46 426 76 432 98 446C108 470 116 496 126 520C140 482 152 446 166 412Z';
const TIP_C = 'M163 193C178 189 192 184 206 180C214 192 220 206 223 218C224 228 222 236 219 242C212 247 205 249 198 249C192 246 187 242 184 238C176 224 168 208 163 193Z';
const TIP_B = 'M213 169C228 165 244 161 258 159C264 174 268 190 271 206C270 216 267 224 262 229C254 233 246 235 238 235C232 231 228 227 225 222C220 204 216 186 213 169Z';
const TIP_A = 'M258 141C276 139 294 137 311 136C315 156 318 176 319 196C316 203 311 208 305 211C296 213 288 213 280 213C275 209 271 204 268 200C264 180 260 160 258 141Z';
const THUMB = 'M336 162C340 152 344 146 350 142C366 142 380 146 392 150C412 166 430 186 446 206C447 212 446 218 444 222C426 228 408 232 392 236C378 230 364 222 352 214C346 198 340 180 336 162Z';

// ---- wrist ring (furthest back) ----------------------------------------
phase(0.5, 0.09, 0.5);
const wr = [
  [[230, 466], [262, 462], [264, 536], [234, 532]],
  [[262, 468], [327, 465], [329, 540], [264, 541]],
  [[327, 466], [400, 460], [403, 533], [329, 540]],
  [[400, 460], [421, 453], [423, 526], [403, 533]],
].map((p) => poly(p, 1.6));
wr.forEach((d, i) => shape(d, 6.5, i === 1 ? 'woodDark' : 'wood'));
detail(hatch(262, 462, 330, 542, 6.5, -0.08), 2.8, wr[1]);   // the dark wood block
detail(hatch(398, 450, 425, 535, 6, -0.3), 2.4, wr[3]);

// ---- palm --------------------------------------------------------------
phase(0.85, 0.12, 0.6);
const palmR = shape('M396 300C420 292 446 292 460 298C468 320 468 360 460 388C452 412 436 430 408 440C400 410 396 350 396 300Z', 6.5, 'woodDark');
const palmM = shape('M300 300C330 280 370 268 396 270C400 320 402 400 400 452C372 462 336 462 310 458C300 420 298 350 300 300Z');
const palmL = shape('M204 388C230 368 268 350 296 344C304 380 306 420 306 456C280 464 250 464 228 458C212 440 202 414 204 388Z');
detail(hatch(392, 288, 472, 446, 8.5, 0.35), 2.4, palmR);
detail('M330 300C324 350 326 410 334 470', 2.6, palmM);
detail('M362 284C372 340 372 400 366 470', 2.6, palmM);
detail('M240 372C238 410 244 440 254 470', 2.6, palmL);
detail('M274 350C280 400 282 430 280 470', 2.6, palmL);

// ---- index finger, pointing up behind the fish -------------------------
phase(1.25, 0.12, 0.45);
shape(poly([[333, 64], [384, 58], [390, 104], [338, 112]], 1.5));
const idxTip = shape(poly([[322, 24], [331, 12], [368, 11], [379, 28], [377, 58], [331, 66], [320, 46]], 1.8));
line('M318 31C340 35 360 31 382 27', 3, idxTip);               // edge between top and front face
shadeFace(idxTip, 'M353 33L390 26L390 70L351 70Z', 'woodDark', hatch(353, 28, 386, 68, 6.5, 0.12));
detail('M353 33L351 66', 2.6, idxTip);

// ---- the fish ----------------------------------------------------------
phase(0, 0, 1.3);
const dorsal = shape('M180 246C160 256 140 276 131 302C142 302 152 296 162 284Z', 4.5, 'fin');
shape(FISH, 7, 'fish');
tint('M520 14C484 16 442 34 410 56C380 74 346 90 315 106C270 133 214 188 170 248C150 278 126 328 106 370L128 384C150 330 180 282 200 262C240 205 290 150 335 124C365 106 392 92 418 74C444 56 478 40 500 37L522 32Z', 'back', FISH);
tint(TAIL, 'fin', FISH);
phase(1.0, 0.09, 0.4);
line('M408 108C340 140 240 250 136 392', 2.6, FISH);                         // lateral line
line('M418 50C400 80 402 116 426 136C436 144 446 147 458 148', 4.5, FISH);    // gill cover
line('M496 66C490 74 484 82 480 91', 3, FISH);                                // corner of the mouth
line('M484 57a9 9 0 1 1-18 0a9 9 0 1 1 18 0', 3.5);                           // eye
ink('M479 57a4 4 0 1 1-8 0a4 4 0 1 1 8 0');
// fins, each with rays that stay inside the fin
const pect = shape('M441 146C432 164 420 182 411 196C426 190 442 172 450 150Z', 4.5, 'fin');
detail('M443 152L420 186M447 153L430 180', 2, pect);
const fin1 = shape('M300 292L350 266C346 292 336 318 322 341C314 326 306 308 300 292Z', 4.5, 'fin');
detail('M344 268L322 342M336 272L319 334M327 277L314 322M318 281L309 312M309 286L304 302', 2.2, fin1);
const fin2 = shape('M274 326C250 344 224 362 200 380C222 384 244 386 262 386C268 366 272 346 274 326Z', 4.5, 'fin');
detail('M270 328L254 390M262 334L242 390M252 342L229 388M241 350L216 386M229 358L206 384', 2.2, fin2);
detail('M104 380L30 422M110 392L62 432M118 402L98 452M128 408L115 484M140 412L125 512M152 414L137 484', 2.2, TAIL);
detail('M176 250L140 296M172 262L150 294', 2, dorsal);
// spots on the back
const dots = (arr) => arr.map(([x, y]) => `M${x} ${y}h.01`).join('');
line(dots([[392, 84], [372, 96], [352, 110], [336, 104], [318, 124], [330, 132], [346, 122], [366, 112], [384, 100],
  [236, 232], [222, 250], [208, 270], [196, 290], [186, 310], [176, 330], [166, 350], [156, 368], [214, 236],
  [200, 256], [186, 278], [174, 300], [162, 322], [152, 344], [142, 362], [230, 262], [216, 282], [204, 302],
  [192, 322], [180, 344], [170, 364], [430, 70], [446, 62]]), 4.4, FISH);
detail(dots([[402, 72], [380, 88], [360, 100], [342, 112], [326, 118], [322, 138], [338, 128], [356, 118], [374, 108],
  [228, 244], [214, 262], [202, 282], [190, 302], [180, 322], [170, 342], [160, 360], [150, 376], [222, 226],
  [208, 246], [194, 268], [182, 288], [168, 312], [158, 334], [146, 354], [136, 372], [238, 252], [224, 272],
  [210, 292], [198, 312], [186, 334], [174, 354], [438, 58], [456, 48], [424, 62]]), 2.8, FISH);
// soft shadows the fingers and thumb cast on the fish: the same shapes, shifted
[TIP_C, TIP_B, TIP_A].forEach((d) => tint(d, 'shadow', FISH, 'translate(5 9)'));
tint(THUMB, 'shadow', FISH, 'translate(-7 7)');

// ---- thumb (in front of the fish) --------------------------------------
phase(1.75, 0.13, 0.45);
const thBase = shape(poly([[384, 238], [446, 226], [459, 240], [459, 290], [392, 297], [383, 270]], 1.8));
shadeFace(thBase, 'M431 220L470 214L470 300L435 302Z', 'woodDark', hatch(431, 222, 462, 298, 6.5, 0.1));
detail('M431 228C433 250 434 272 435 296', 2.6, thBase);
shape(THUMB);
// faces of the thumb: a lit top edge, a lit front facet under the nail, a shaded lower facet
shadeFace(THUMB, 'M397 177C414 190 430 204 444 216L452 246L372 246L352 214Z', 'woodDark', hatch(350, 176, 452, 242, 9, -0.9));
line('M397 177C414 190 430 204 446 217', 2.8, THUMB);
line('M397 177C382 189 367 201 351 215', 2.8, THUMB);
shape('M351 149C364 149 377 150 388 153C392 161 395 169 397 176C390 180 383 181 377 181C368 178 359 174 352 170C351 163 350 156 351 149Z', 3.6, 'nail');

// ---- three fingers curling over the fish (front) -----------------------
function finger(t0, b1, b2, tip, nail, side, edge) {
  phase(t0, 0.06, 0.4);
  const d1 = shape(poly(b1, 1.6));
  if (b2) shape(poly(b2, 1.6));
  shape(tip);
  tint(side, 'woodDark', tip);
  shape(nail, 3.6, 'nail');
  detail(edge, 2.8, d1);                                       // edge between top and front face
}
finger(2.0, [[155, 172], [168, 155], [200, 152], [206, 180], [163, 193]], null, TIP_C,
  'M186 213C194 209 203 207 211 206C217 214 221 224 223 233C220 240 216 244 211 246C205 248 200 248 196 247C191 236 188 224 186 213Z',
  'M206 180L230 180L230 252L214 252C218 240 220 226 212 206Z',
  'M150 179C174 174 190 170 212 165');
finger(2.2, [[200, 113], [212, 105], [244, 105], [250, 128], [205, 137]], [[204, 137], [250, 128], [258, 159], [213, 169]], TIP_B,
  'M231 195C240 191 250 189 258 188C263 198 267 209 269 219C266 225 262 229 258 230C252 233 246 233 240 233C236 220 233 207 231 195Z',
  'M258 159L280 159L280 240L262 240C266 226 266 208 258 188Z',
  'M194 120C216 117 232 114 256 112');
finger(2.4, [[250, 83], [262, 72], [298, 70], [305, 81], [306, 100], [252, 105]], [[252, 105], [306, 100], [311, 136], [258, 141]], TIP_A,
  'M277 173C286 170 296 168 304 167C308 178 312 189 314 199C310 205 305 208 300 209C294 211 288 211 283 210C280 198 278 185 277 173Z',
  'M311 136L330 136L330 220L310 220C313 206 312 186 304 167Z',
  'M244 90C268 87 286 85 312 83');

// ---- output ------------------------------------------------------------
const defs = () => clips.map((d, i) => `<clipPath id="c${i}"><path d="${d}"/></clipPath>`).join('');
// one group per clip, so a detail is confined to the intersection of its clips
const wrapClips = (l, inner) => l.clip.reduce((acc, c) => `<g clip-path="url(#c${c})">${acc}</g>`, inner);

function still({ colour = true } = {}) {
  let body = '';
  for (const l of layers) {
    const tf = l.tf ? ` transform="${l.tf}"` : '';
    if (l.kind === 'tint') { if (colour) body += wrapClips(l, `<path d="${l.d}" fill="${TONE[l.tone]}"${tf}/>`); continue; }
    if (l.kind === 'shape') body += `<path d="${l.d}" fill="${colour ? TONE[l.tone] : PAPER}" stroke="${INK}" stroke-width="${l.w}"/>`;
    else if (l.kind === 'ink') body += `<path d="${l.d}" fill="${INK}"/>`;
    else body += wrapClips(l, `<path d="${l.d}" fill="none" stroke="${INK}" stroke-width="${l.w}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.join(' ')}" stroke-linecap="round" stroke-linejoin="round"><defs>${defs()}</defs>${body}</svg>`;
}

function animated() {
  let body = '';
  for (const l of layers) {
    const st = `--t:${l.t}s;--u:${l.u}s`;
    const tf = l.tf ? ` transform="${l.tf}"` : '';
    if (l.kind === 'tint') body += wrapClips(l, `<path class="o" style="${st}" d="${l.d}" fill="${TONE[l.tone]}"${tf}/>`);
    else if (l.kind === 'shape') body += `<path class="s c" pathLength="1" style="${st};--f:${TONE[l.tone]}" d="${l.d}" stroke-width="${l.w}"/>`;
    else if (l.kind === 'ink') body += `<path class="o k" style="${st}" d="${l.d}"/>`;
    else body += wrapClips(l, `<path class="s" pathLength="1" style="${st}" d="${l.d}" stroke-width="${l.w}"/>`);
  }
  const css = `.s{fill:none;stroke:${INK};stroke-opacity:0;stroke-dasharray:1;stroke-dashoffset:1;animation:d var(--u) cubic-bezier(.6,0,.3,1) var(--t) forwards}.c{fill:${PAPER};animation:d var(--u) cubic-bezier(.6,0,.3,1) var(--t) forwards,c .7s ease 3.05s forwards}.o{opacity:0;animation:o var(--u) ease var(--t) forwards}.k{fill:${INK}}@keyframes d{from{stroke-opacity:1}to{stroke-opacity:1;stroke-dashoffset:0}}@keyframes c{to{fill:var(--f)}}@keyframes o{to{opacity:1}}@media (prefers-reduced-motion:reduce){.s,.c,.o{animation-duration:.01s!important;animation-delay:0s!important}}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.join(' ')}" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="A wooden hand holding a fish"><style>${css}</style><defs>${defs()}</defs><rect x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" fill="${PAPER}"/>${body}</svg>`;
}

// data module for the app component
function dataModule() {
  const rows = layers.map((l) => {
    const o = { k: l.kind[0], d: l.d, t: l.t, u: l.u };
    if (l.w) o.w = l.w;
    if (l.tone) o.f = TONE[l.tone];
    if (l.clip.length) o.c = l.clip;
    if (l.tf) o.x = l.tf;
    return '  ' + JSON.stringify(o) + ',';
  }).join('\n');
  return `// Generated by design/logo/generate.mjs. Do not edit by hand.

export type LogoLayer = {
  /** s = outlined shape, l = line, t = flat tint, i = solid ink */
  k: "s" | "l" | "t" | "i";
  d: string;
  /** animation delay and duration, in seconds */
  t: number;
  u: number;
  /** stroke width */
  w?: number;
  /** fill colour */
  f?: string;
  /** indexes into logoClips; the layer is confined to all of them */
  c?: number[];
  /** transform */
  x?: string;
};

export const logoViewBox = "${VB.join(' ')}";

export const logoClips: string[] = ${JSON.stringify(clips, null, 2)};

export const logoLayers: LogoLayer[] = [
${rows}
];
`;
}

const out = process.env.LOGO_OUT || import.meta.dirname;
const dataFile = process.env.LOGO_DATA || path.join(import.meta.dirname, '..', '..', 'src', 'components', 'logo', 'logo-data.ts');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'kubbe-logo.svg'), still());
fs.writeFileSync(path.join(out, 'kubbe-logo-line.svg'), still({ colour: false }));
fs.writeFileSync(path.join(out, 'kubbe-logo-animated.svg'), animated());
if (dataFile !== 'none') { fs.mkdirSync(path.dirname(dataFile), { recursive: true }); fs.writeFileSync(dataFile, dataModule()); }
console.log('layers', layers.length, 'clips', clips.length);

// A simplified cut for small sizes: the shapes and their colours, heavier outlines,
// and none of the hatching, grain, fin rays or spots that turn to mud when tiny.
function icon({ background = PAPER, scale = 0.84, weight = 1.5 } = {}) {
  const size = 600;
  let body = '';
  for (const l of layers) {
    if (l.kind === 'line' && (l.w < 3.5 || l.d.includes('h.01'))) continue;
    if (l.kind === 'tint' && l.tone === 'shadow') continue;
    const tf = l.tf ? ` transform="${l.tf}"` : '';
    if (l.kind === 'tint') body += wrapClips(l, `<path d="${l.d}" fill="${TONE[l.tone]}"${tf}/>`);
    else if (l.kind === 'shape') body += `<path d="${l.d}" fill="${TONE[l.tone]}" stroke="${INK}" stroke-width="${l.w * weight}"/>`;
    else if (l.kind === 'ink') body += `<path d="${l.d}" fill="${INK}"/>`;
    else body += wrapClips(l, `<path d="${l.d}" fill="none" stroke="${INK}" stroke-width="${l.w * weight}"/>`);
  }
  const x = (size - VB[2] * scale) / 2 - VB[0] * scale;
  const y = (size - VB[3] * scale) / 2 - VB[1] * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" stroke-linecap="round" stroke-linejoin="round"><defs>${defs()}</defs><rect width="${size}" height="${size}" fill="${background}"/><g transform="translate(${f(x)} ${f(y)}) scale(${scale})">${body}</g></svg>`;
}
fs.writeFileSync(path.join(out, 'kubbe-icon.svg'), icon());

// App icons. Needs sharp, which Next.js already brings along.
if (process.argv.includes('--icons')) {
  const { default: sharp } = await import('sharp');
  const root = path.join(import.meta.dirname, '..', '..');
  const render = (svg, px, file) => sharp(Buffer.from(svg), { density: 72 * px / 600 }).resize(px, px).png().toFile(path.join(root, file));
  fs.mkdirSync(path.join(root, 'public', 'icons'), { recursive: true });
  await render(icon({ scale: 0.92, weight: 2 }), 96, 'src/app/icon.png');
  await render(icon(), 180, 'src/app/apple-icon.png');
  await render(icon(), 192, 'public/icons/icon-192.png');
  await render(icon(), 512, 'public/icons/icon-512.png');
  // Phones may crop a maskable icon to a circle, so the drawing keeps to the middle.
  await render(icon({ scale: 0.64 }), 512, 'public/icons/icon-maskable-512.png');
  console.log('icons written');
}

if (process.argv.includes('--preview')) {
  // sharp is not a project dependency: install it ad hoc when previews are needed
  const { default: sharp } = await import('sharp');
  const png = (svg, px) => sharp(Buffer.from(svg), { density: 72 * px / VB[2] }).resize(px).flatten({ background: PAPER }).png();
  (async () => {
    await png(still(), 900).toFile(path.join(out, 'kubbe-logo.png'));
    await png(still({ colour: false }), 900).toFile(path.join(out, 'kubbe-logo-line.png'));
    if (process.env.LOGO_ZOOM) {
      const big = await png(still(), 2240).toBuffer();
      const R = (x, y, w, h) => ({ left: Math.round((x + 8) * 4), top: Math.round((y + 2) * 4), width: w * 4, height: h * 4 });
      await sharp(big).extract(R(300, 0, 250, 310)).resize(1000).toFile(path.join(out, 'zoom-a.png'));
      await sharp(big).extract(R(140, 60, 300, 250)).resize(1000).toFile(path.join(out, 'zoom-c.png'));
    }
    console.log('previews written');
  })();
}
