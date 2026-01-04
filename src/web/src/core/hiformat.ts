// hiformat.ts

import { extractImageData, type ImageDataResult } from "./image_manip";

type HIFormatFlag = 15 | 16;

class HIFormat {
    width: number;
    height: number;
    flag: HIFormatFlag;
    imageData: Uint16Array; // flat array: row-major order

    constructor(width: number, height: number, flag: HIFormatFlag, imageData?: Uint16Array) {
        this.width = width;
        this.height = height;
        this.flag = flag;
        this.imageData = imageData ?? new Uint16Array(width * height);
    }

    static isSupported(buffer: ArrayBuffer) : boolean{
        const view = new DataView(buffer);
        const width = view.getUint16(0, true);
        const height = view.getUint16(2, true);
        const flag = view.getUint16(4, true) as HIFormatFlag;
        const pixelCount = width * height;
        return (flag == 15 || flag == 16) 
                    && ((pixelCount + 3)*2) == buffer.byteLength;
    }

    static fromArrayBuffer(buffer: ArrayBuffer): HIFormat {
        const view = new DataView(buffer);
        const width = view.getUint16(0, true);
        const height = view.getUint16(2, true);
        const flag = view.getUint16(4, true) as HIFormatFlag;
        const pixelCount = width * height;
        const imageData = new Uint16Array(buffer, 6, pixelCount);
        return new HIFormat(width, height, flag, new Uint16Array(imageData));
    }

    static fromImageData(imgData: ImageDataResult) : HIFormat{
        const total = imgData.width*imgData.height;
        const imageData = new Uint16Array(imgData.width*imgData.height);
        let offset = 0;
        for (let idx = 0; idx < total; ++idx) {
            const r = imgData.data[4*offset];
            const g = imgData.data[4*offset+1];
            const b = imgData.data[4*offset+2];
            const c = ((r & 0xF8)<<7)
                        |((g & 0xF8) << 2)
                        |((b & 0xF8) >> 3);
            imageData[offset] = c;
            ++offset;
        }
        return new HIFormat(imgData.width, imgData.height, 15, imageData);
    }

    static async fromImage(img:HTMLImageElement) : Promise<HIFormat>{
        const imgData = await extractImageData(img);
        return this.fromImageData(imgData);
    }

    toArrayBuffer(): ArrayBuffer {
        const buffer = new ArrayBuffer(6 + this.width * this.height * 2);
        const view = new DataView(buffer);
        view.setUint16(0, this.width, true);
        view.setUint16(2, this.height, true);
        view.setUint16(4, this.flag, true);
        new Uint16Array(buffer, 6).set(this.imageData);
        return buffer;
    }

    getPixel(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) throw new RangeError('Pixel out of bounds');
        return this.imageData[y * this.width + x];
    }

    setPixel(x: number, y: number, value: number): void {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) throw new RangeError('Pixel out of bounds');
        this.imageData[y * this.width + x] = value & 0xFFFF;
    }

    // Converts a HI pixel value to RGBA8888
    private pixelToRGBA(pixel: number): [number, number, number, number] {
        if (this.flag === 15) {
            // XRGB1555
            const r = ((pixel >> 10) & 0x1F) << 3;
            const g = ((pixel >> 5) & 0x1F) << 3;
            const b = (pixel & 0x1F) << 3;
            return [r + (r>>5), g + (g >> 5), b + (b >> 5), 255];
        } else if (this.flag === 16) {
            // RGB565
            const r = ((pixel >> 11) & 0x1F) << 3;
            const g = ((pixel >> 5) & 0x3F) << 2;
            const b = (pixel & 0x1F) << 3;
            return [r, g, b, 255];
        } else {
            return [0, 0, 0, 255];
        }
    }

    // Converts RGBA8888 to HI pixel value
    private rgbaToPixel(r: number, g: number, b: number): number {
        if (this.flag === 15) {
            // XRGB1555
            return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        } else if (this.flag === 16) {
            // RGB565
            return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
        } else {
            return 0;
        }
    }

    // Create a Canvas element with the image rendered
    createCanvas(): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');
        const imageData = ctx.createImageData(this.width, this.height);
        for (let i = 0; i < this.width * this.height; ++i) {
            const [r, g, b, a] = this.pixelToRGBA(this.imageData[i]);
            imageData.data[i * 4 + 0] = r;
            imageData.data[i * 4 + 1] = g;
            imageData.data[i * 4 + 2] = b;
            imageData.data[i * 4 + 3] = a;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }


}

export default HIFormat