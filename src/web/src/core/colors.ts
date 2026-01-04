export type RGB = [number, number, number];
export type RGBPalette = RGB[];
export type HSL = [number,number, number];

const { abs, min, max, round } = Math;

export function hslToRgb(hsl : HSL):RGB {
  let r, g, b;
  let [h,s,l] = hsl;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1/3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1/3);
  }

  return [round(r * 255), round(g * 255), round(b * 255)];
}

function hueToRgb(p:number, q:number, t:number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

export function rgbToHsl(rgb : RGB ) : HSL{
  let [r,g,b] = rgb;
  (r /= 255), (g /= 255), (b /= 255);
  const vmax = max(r, g, b), vmin = min(r, g, b);
  let h = 0, s = 0, l = (vmax + vmin) / 2;

  if (vmax === vmin) {
    return [0, 0, l]; // achromatic
  }

  const d = vmax - vmin;
  s = l > 0.5 ? d / (2 - vmax - vmin) : d / (vmax + vmin);
  if (vmax === r) h = (g - b) / d + (g < b ? 6 : 0);
  if (vmax === g) h = (b - r) / d + 2;
  if (vmax === b) h = (r - g) / d + 4;
  h /= 6;

  return [h, s, l];
}