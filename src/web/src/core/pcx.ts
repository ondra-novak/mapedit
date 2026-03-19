// PCX 256-color (8-bit) image support

import { extractImageData, findQuantizationAndGeneratePalette, type ImageDataResult } from "./image_manip";
import { ColorLUT } from "./lut";
import type { RGBPalette } from "./colors";
import { BinaryWriter } from "./binary";


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

    static isSupported(buffer: ArrayBuffer) : boolean{
        if (buffer.byteLength < 128) return false;
        const view = new DataView(buffer);
        if (view.getUint8(0) !== 0x0A) return false; // Manufacturer
        if (view.getUint8(1) !== 5) return false;    // Version 3.0+
        if (view.getUint8(3) !== 8) return false;    // 8 bits per pixel
        // Check for palette marker at the end
        if (buffer.byteLength < 769 + 128) return false;
        const paletteMarkerOffset = buffer.byteLength - 769;
        const paletteMarker = new Uint8Array(buffer, paletteMarkerOffset, 1)[0];
        if (paletteMarker !== 0x0C) return false;
        return true;
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
    createCanvas(profile: PCXProfileType, altpalette?: RGBPalette): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");
        const imageData = ctx.createImageData(this.width, this.height);
        const data = imageData.data;
        const pal = altpalette?PCX.create_palette(altpalette):this.palette;
        let i = 0;
        for (let y = 0; y < this.height; ++y) {
            let yofs = ((profile == PCXProfile.wall)
                            ?this.height-y-1:y) * this.width;
            for (let x = 0; x < this.width; ++x) {
                const idx = this.pixels[yofs+x];
                const palIdx = idx * 3;
                let r = pal[palIdx];
                let g = pal[palIdx + 1];
                let b = pal[palIdx + 2];
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

    toDataURL(profile: PCXProfileType, altpalette?: RGBPalette):string {
        return this.createCanvas(profile, altpalette).toDataURL();
    }

    static create_palette(rgb: RGBPalette) {
        const pal = new Uint8Array(256 * 3);
        for (let i = 0; i < 256; i++) {
            const color = rgb[i] || { r: 0, g: 0, b: 0 };
            pal[i * 3] = color[0] & 0xFF;
            pal[i * 3 + 1] = color[1] & 0xFF;
            pal[i * 3 + 2] = color[2] & 0xFF;
        }
        return pal;
    }

    set_palete(rgb: RGBPalette ) {
        this.palette = PCX.create_palette(rgb);
    }

    get_palette(): RGBPalette {
        const palette: RGBPalette = [];
        for (let i = 0; i < 256; i++) {
            const r = this.palette[i * 3];
            const g = this.palette[i * 3 + 1];
            const b = this.palette[i * 3 + 2];
            palette.push([r, g, b]);
        }
        return palette;
    }

    convertImageData(imageData: ImageDataResult, lut: ColorLUT, indexOffset: number, minAlpha: number, maxAlpha: number) : void{
        const { data, width, height } = imageData;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];
                if (a < minAlpha || a > maxAlpha) {
                    continue;
                }
                const lutIdx = lut.lookup([ r, g, b ]);
                this.setPixel(x, y, (lutIdx + indexOffset) & 0xFF);
            }
        }
    }

    clear(index:number) {
        this.pixels.fill(index & 0xFF);
    }


    static async fromImage(img:HTMLImageElement|HTMLCanvasElement, profile: PCXProfileType) : Promise<PCX>{
        const imgdata = await extractImageData(img);
        if (profile == PCXProfile.wall) {
            const pal = findQuantizationAndGeneratePalette([imgdata],253,128,255);
            const lut = new ColorLUT(pal, 6);
            const pcx = new PCX(imgdata.width, imgdata.height);
            pal.unshift([0,0,0]);
            pal.unshift([0,0,0]);            
            pcx.set_palete(pal);
            pcx.clear(0);
            pcx.convertImageData(imgdata, lut, 2, 128, 255);
            pcx.flipVertically();
            return pcx;
        }
        else if (profile == PCXProfile.enemy) {
            const pal1 = findQuantizationAndGeneratePalette([imgdata],127,173,255);
            const pal2 = findQuantizationAndGeneratePalette([imgdata],127,85,172);
            const lut1 = new ColorLUT(pal1, 6);
            const lut2 = new ColorLUT(pal2, 6);
            pal1.unshift([0,0,0]);
            const pcx = new PCX(imgdata.width, imgdata.height);
            pcx.set_palete(pal1.concat(pal2));
            pcx.clear(0);
            pcx.convertImageData(imgdata, lut1, 1, 173, 255);
            pcx.convertImageData(imgdata, lut2, 128, 85, 172);
            return pcx;
        } else if (profile == PCXProfile.item) {
            const pal = findQuantizationAndGeneratePalette([imgdata],253,128,255);
            const lut = new ColorLUT(pal, 6);
            const pal2 : RGBPalette= [ [1,1,1] ];
            const lut2 = new ColorLUT(pal2, 6);
            const pcx = new PCX(imgdata.width, imgdata.height);
            pal2.unshift([0,0,0]);
            pcx.set_palete(pal2.concat(pal));
            pcx.clear(0);
            pcx.convertImageData(imgdata, lut, 2, 173, 255);
            pcx.convertImageData(imgdata, lut2, 1, 85, 172);
            return pcx;
        } else {
            const pal = findQuantizationAndGeneratePalette([imgdata],254,128,255);
            const lut = new ColorLUT(pal, 6);
            const pcx = new PCX(imgdata.width, imgdata.height);
            pal.unshift([0,0,0]);
            pcx.set_palete(pal);
            pcx.clear(0);
            pcx.convertImageData(imgdata, lut,1, 128, 255);            
            return pcx;
        }
        return new PCX(imgdata.width, imgdata.height);

    }

    static mergeCanvases(canvases: HTMLCanvasElement[]) : HTMLCanvasElement {
        // spočítat výslednou velikost (např. vedle sebe)
        let width = 0;
        let height = 0;

        for (const c of canvases) {
            height += c.height;
            width = Math.max(width, c.width);
        }

        const result = document.createElement("canvas");
        result.width = width;
        result.height = height;

        const ctx = result.getContext("2d");
        if (!ctx) throw new Error("Canvas returned NULL");

        let y = 0;
        for (const c of canvases) {
            ctx.drawImage(c, 0, y);
            y += c.height;
        }

        return result;
    }

    static async createCommonPalette(images: PCX[], profile: PCXProfileType) : Promise<PCX[]> {
        const m = images.map(x=>x.createCanvas(profile));
        const bigimg = PCX.mergeCanvases(m);
        const large_pcx = await PCX.fromImage(bigimg,profile);
        let y = 0;
        const out = images.map(img=>{
            const h = img.height;
            const sz = h * img.width;
            const lsz = h * large_pcx.width
            const wr = new BinaryWriter();
            for (let i = 0; i < h; ++i) {
                const beg = (i + y) * large_pcx.width;
                const buff = large_pcx.pixels.buffer.slice(beg,beg+img.width) as ArrayBuffer;
                wr.write_buffer(buff);
            }
            y+=img.height;
            return new PCX(img.width, img.height, new Uint8Array(wr.getBuffer()), large_pcx.palette);
        })
        return out;
    }


}