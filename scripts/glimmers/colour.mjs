// The Glimmer colour lift, for base-colour textures (used by lift.mjs and tidy.mjs). Works in OKLCH:
//   gamma < 1 lifts lightness (the darkest texels, pupils and outlines, are spared);
//   vib > 0 is a vibrance boost: dull colours gain the most chroma, vivid ones are left nearly alone;
//   hue = [from, to, shift] turns one band of hues (degrees) by `shift`, fading at the band's edges.
// Colours that leave sRGB keep their lightness and hue and lose chroma (clipping would turn light
// blues cyan).

const M1 = [[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]];
const M2 = [[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]];
const inv3 = (m) => {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
};
const M1i = inv3(M1), M2i = inv3(M2);
const mul = (m, x, y, z) => [m[0][0] * x + m[0][1] * y + m[0][2] * z, m[1][0] * x + m[1][1] * y + m[1][2] * z, m[2][0] * x + m[2][1] * y + m[2][2] * z];
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; };
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const labToLin = (L, a, b) => { const [l, m, s] = mul(M2i, L, a, b); return mul(M1i, l * l * l, m * m * m, s * s * s); };
const inGamut = (c) => c[0] >= -1e-4 && c[1] >= -1e-4 && c[2] >= -1e-4 && c[0] <= 1 + 1e-4 && c[1] <= 1 + 1e-4 && c[2] <= 1 + 1e-4;

/** Lift RGB(A) pixels in place. `px`: Uint8Array/Uint8ClampedArray, `channels`: 3 or 4. */
export function liftPixels(px, channels, { gamma = 1, vib = 0, hue = null, cmax = 0.22 } = {}) {
  for (let i = 0; i < px.length; i += channels) {
    const [l0, m0, s0] = mul(M1, toLin(px[i] / 255), toLin(px[i + 1] / 255), toLin(px[i + 2] / 255));
    let [L, a, b] = mul(M2, Math.cbrt(l0), Math.cbrt(m0), Math.cbrt(s0));
    L = Math.min(1, Math.max(0, L));
    const C = Math.hypot(a, b);
    L = L + (L ** gamma - L) * smooth(0.06, 0.32, L);
    let k = vib >= 0 ? 1 + vib * (1 - Math.min(1, C / cmax)) ** 1.5 : 1 + vib;
    k = 1 + (k - 1) * smooth(0.004, 0.02, C); // near-greys: don't invent colour from compression noise
    a *= k; b *= k;
    if (hue) {
      const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360, [lo, hi, sh] = hue;
      const w = smooth(lo - 10, lo + 5, h) * (1 - smooth(hi - 5, hi + 10, h)), t = (sh * w * Math.PI) / 180;
      [a, b] = [a * Math.cos(t) - b * Math.sin(t), a * Math.sin(t) + b * Math.cos(t)];
    }
    let rgb = labToLin(L, a, b);
    if (!inGamut(rgb)) {
      let lo = 0, hi = 1;
      for (let n = 0; n < 12; n++) { const mid = (lo + hi) / 2; if (inGamut(labToLin(L, a * mid, b * mid))) lo = mid; else hi = mid; }
      rgb = labToLin(L, a * lo, b * lo);
    }
    px[i] = Math.round(toSrgb(rgb[0]) * 255); px[i + 1] = Math.round(toSrgb(rgb[1]) * 255); px[i + 2] = Math.round(toSrgb(rgb[2]) * 255);
  }
  return px;
}
