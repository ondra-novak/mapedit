import type { RGB, RGBPalette } from "./colors";

const COL_SIZE = 776;
const PALETTE_DATA_OFFSET = 8;
const PALETTE_COLOR_COUNT = 256;


export class COLPaletteSet {
  palettes: RGBPalette[] = [];

  constructor() {}

  static fromArrayBuffer(buffer: ArrayBuffer): COLPaletteSet {
    const view = new Uint8Array(buffer);
    const paletteSet = new COLPaletteSet();
    const count = Math.floor(view.length / COL_SIZE);

    for (let i = 0; i < count; i++) {
      const offset = i * COL_SIZE + PALETTE_DATA_OFFSET;
      const palette: RGBPalette = [];

      for (let j = 0; j < PALETTE_COLOR_COUNT; j++) {
        const base = offset + j * 3;
        const r = view[base];
        const g = view[base + 1];
        const b = view[base + 2];
        palette.push([r, g, b]);
      }

      paletteSet.palettes.push(palette);
    }

    return paletteSet;
  }

  toArrayBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(this.palettes.length * COL_SIZE);
    const view = new Uint8Array(buffer);

    this.palettes.forEach((palette, i) => {
      const offset = i * COL_SIZE;
      // Optional: write header or leave zeroed (8 bytes)
      const base = offset + PALETTE_DATA_OFFSET;

      palette.forEach(([r, g, b], j) => {
        const index = base + j * 3;
        view[index] = r;
        view[index + 1] = g;
        view[index + 2] = b;
      });
    });

    return buffer;
  }

  getPaletteCount(): number {
    return this.palettes.length;
  }

  getPalette(index: number): RGBPalette {
    return this.palettes[index];
  }

  setPalette(index: number, palette: RGBPalette): void {
    if (palette.length !== PALETTE_COLOR_COUNT) {
      throw new Error("Palette must contain exactly 256 colors");
    }
    this.palettes[index] = palette;
  }

  getColor(paletteIndex: number, colorIndex: number): RGB {
    return this.palettes[paletteIndex][colorIndex];
  }

  setColor(paletteIndex: number, colorIndex: number, color: RGB): void {
    this.palettes[paletteIndex][colorIndex] = color;
  }

  addPalette(palette?: RGB[]): void {
    if (palette && palette.length !== PALETTE_COLOR_COUNT) {
      throw new Error("Palette must contain exactly 256 colors");
    }
    this.palettes.push(palette ?? this.createEmptyPalette());
  }

  private createEmptyPalette(): RGB[] {
    return Array.from({ length: PALETTE_COLOR_COUNT }, () => [0, 0, 0]);
  }
}
