// PCX 256-color (8-bit) image support


export const PCXProfile = {
    //import all colors from palette
    "default":0,
    //assume index 0 is transparent color
    "transp0":1,
    //walls - origin is bottom, index 0 and 1 is transparency
    "wall":2,
    //items - origin is bottom, index 0 transparent, index 1 gray 50% alpha
    "item":3,
    //enemies - origin is bottom, index 0 transparent, indices 128-255 is alhpa 50%
    "enemy":4,
} as const;

export type PCXProfileType = typeof PCXProfile[keyof typeof PCXProfile];

export class PCX {
    width: number;
    height: number;
    pixels: Uint8Array; // Indexed color (0-255)
    palette: Uint8Array; // 768 bytes (256 * 3)

    constructor(width: number, height: number, pixels?: Uint8Array, palette?: Uint8Array) {
        this.width = width;
        this.height = height;
        this.pixels = pixels ?? new Uint8Array(width * height);
        this.palette = palette ?? new Uint8Array(768);
    }

    static fromArrayBuffer(buffer: ArrayBuffer): PCX {
        const view = new DataView(buffer);
        // PCX header is 128 bytes
        if (view.getUint8(0) !== 0x0A) throw new Error("Not a PCX file");
        if (view.getUint8(1) !== 5) throw new Error("Only PCX version 3.0+ supported");
        if (view.getUint8(3) !== 8) throw new Error("Only 8-bit PCX supported");
        const xmin = view.getUint16(4, true);
        const ymin = view.getUint16(6, true);
        const xmax = view.getUint16(8, true);
        const ymax = view.getUint16(10, true);
        const width = xmax - xmin + 1;
        const height = ymax - ymin + 1;
        const bytesPerLine = view.getUint16(66, true);

        // Find palette: last 769 bytes, 0x0C marker + 768 palette bytes
        const paletteMarkerOffset = buffer.byteLength - 769;
        const paletteMarker = new Uint8Array(buffer, paletteMarkerOffset, 1)[0];
        if (paletteMarker !== 0x0C) throw new Error("Missing PCX palette marker");
        const palette = new Uint8Array(buffer, paletteMarkerOffset + 1, 768);

        // Decode image data (RLE)
        const dataStart = 128;
        const dataEnd = paletteMarkerOffset;
        const data = new Uint8Array(buffer, dataStart, dataEnd - dataStart);
        const pixels = new Uint8Array(width * height);

        let src = 0, dst = 0;
        for (let y = 0; y < height; y++) {
            let linePixels = 0;
            while (linePixels < bytesPerLine && src < data.length) {
                let value = data[src++];
                let count = 1;
                if ((value & 0xC0) === 0xC0) {
                    count = value & 0x3F;
                    value = data[src++];
                }
                for (let i = 0; i < count && linePixels < bytesPerLine; i++, linePixels++) {
                    if (linePixels < width && dst < pixels.length) {
                        pixels[dst++] = value;
                    }
                }
            }
        }

        return new PCX(width, height, pixels, new Uint8Array(palette));
    }

    toArrayBuffer(): ArrayBuffer {
        // Prepare header
        const header = new Uint8Array(128);
        header[0] = 0x0A; // Manufacturer
        header[1] = 5;    // Version
        header[2] = 1;    // Encoding (RLE)
        header[3] = 8;    // Bits per pixel
        // Xmin, Ymin, Xmax, Ymax (little endian)
        const xmax = this.width - 1;
        const ymax = this.height - 1;
        header[4] = 0; header[5] = 0; // xmin
        header[6] = 0; header[7] = 0; // ymin
        header[8] = xmax & 0xFF; header[9] = (xmax >> 8) & 0xFF;
        header[10] = ymax & 0xFF; header[11] = (ymax >> 8) & 0xFF;
        header[12] = 72; // HDpi
        header[13] = 0;
        header[14] = 72; // VDpi
        header[15] = 0;
        // Palette (16 colors, unused for 8-bit)
        // Fill with zeros
        // Reserved
        header[64] = 0;
        // Number of color planes
        header[65] = 1;
        // Bytes per line (must be even)
        const bytesPerLine = (this.width + 1) & ~1;
        header[66] = bytesPerLine & 0xFF;
        header[67] = (bytesPerLine >> 8) & 0xFF;
        // Palette info
        header[68] = 1; // 1=color/bw, 2=grayscale
        // Rest is zero

        // Encode image data (RLE)
        const encoded: number[] = [];
        for (let y = 0; y < this.height; y++) {
            let offset = y * this.width;
            for (let x = 0; x < bytesPerLine; x++) {
                let value = x < this.width ? this.pixels[offset + x] : 0;
                let count = 1;
                // RLE: count up to 63
                while (
                    x + count < bytesPerLine &&
                    count < 63 &&
                    (x + count < this.width ? this.pixels[offset + x + count] : 0) === value
                ) {
                    count++;
                }
                if (count > 1 || (value & 0xC0) === 0xC0) {
                    encoded.push(0xC0 | count, value);
                    x += count - 1;
                } else {
                    encoded.push(value);
                }
            }
        }

        // Palette marker + palette
        const paletteMarker = new Uint8Array([0x0C]);
        const palette = this.palette.length === 768 ? this.palette : new Uint8Array(768);

        // Compose final buffer
        const totalSize = 128 + encoded.length + 1 + 768;
        const out = new Uint8Array(totalSize);
        out.set(header, 0);
        out.set(encoded, 128);
        out.set(paletteMarker, 128 + encoded.length);
        out.set(palette, 128 + encoded.length + 1);

        return out.buffer;
    }

    getPixel(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) throw new RangeError("Out of bounds");
        return this.pixels[y * this.width + x];
    }

    setPixel(x: number, y: number, value: number): void {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) throw new RangeError("Out of bounds");
        this.pixels[y * this.width + x] = value & 0xFF;
    }

    flipVertically(): void {
        const rowSize = this.width;
        for (let y = 0; y < Math.floor(this.height / 2); y++) {
            const topOffset = y * rowSize;
            const bottomOffset = (this.height - 1 - y) * rowSize;
            for (let x = 0; x < rowSize; x++) {
                const topIdx = topOffset + x;
                const bottomIdx = bottomOffset + x;
                const temp = this.pixels[topIdx];
                this.pixels[topIdx] = this.pixels[bottomIdx];
                this.pixels[bottomIdx] = temp;
            }
        }
    }
    createCanvas(profile: PCXProfileType): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");
        const imageData = ctx.createImageData(this.width, this.height);
        const data = imageData.data;
        let i = 0;
        for (let y = 0; y < this.height; ++y) {
            let yofs = ((profile == PCXProfile.wall)
                            ?this.height-y-1:y) * this.width;
            for (let x = 0; x < this.width; ++x) {
                const idx = this.pixels[yofs+x];
                const palIdx = idx * 3;
                let r = this.palette[palIdx];
                let g = this.palette[palIdx + 1];
                let b = this.palette[palIdx + 2];
                let a = 255;
                switch (profile) {
                    default:
                    case PCXProfile.default:
                        // No transparency
                        break;
                    case PCXProfile.transp0:
                        if (idx === 0) a = 0;
                        break;
                    case PCXProfile.wall:
                        if (idx === 0 || idx === 1) a = 0;
                        break;
                    case PCXProfile.item:
                        if (idx === 0) {
                            a = 0;
                        } else if (idx === 1) {
                            r = 0; g = 0; b = 0; a = 128;
                        }
                        break;
                    case PCXProfile.enemy:
                        if (idx === 0) {
                            a = 0;
                        } else if (idx >= 128) {
                            a = 128;
                        }
                        break;
                }
                const di = i * 4;
                data[di] = r;
                data[di + 1] = g;
                data[di + 2] = b;
                data[di + 3] = a;
                ++i;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }




}