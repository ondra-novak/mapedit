import { rgbToHsl, type RGB, type RGBPalette } from "./colors";

export type ImageDataResult = ImageData;

/**
 * Extracts dimensions and RGBA pixel data from an HTMLImageElement.
 * @param img HTMLImageElement
 * @returns Promise resolving to ImageDataResult
 */
export function extractImageData(arg: HTMLImageElement|HTMLCanvasElement): Promise<ImageDataResult> {
    return new Promise((resolve, reject) => {

        if (arg instanceof HTMLCanvasElement) {
            const canvas = arg as HTMLCanvasElement;            
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("canvas getContext returned null")
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve({
                width: canvas.width,
                height: canvas.height,
                data: imageData.data,
                colorSpace: "srgb"
                } as ImageDataResult);                
        } else {
            const img = arg as HTMLImageElement;
            

            if (!img.complete) {
                img.onload = () => resolve(getData());
                img.onerror = reject;
            } else {
                resolve(getData());
            }

            function getData(): ImageDataResult {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get 2D context');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                return {
                    width: canvas.width,
                    height: canvas.height,
                    data: imageData.data,
                    colorSpace: "srgb"
                };
            }
        }
    });
}

/// Creates an RGB color histogram from image data.
export class HistogramState {
    hist: Record<string, { count: number; sumR: number; sumG: number; sumB: number }> = {};
    q: number;
    minAlpha: number;
    maxAlpha: number;

    /**
    * @param q Quantization factor for RGB channels
    * @param minAlpha Minimum alpha value (inclusive)
    * @param maxAlpha Maximum alpha value (inclusive)
    * */
    constructor(q: number,minAlpha: number,maxAlpha: number) {
        this.q = q;
        this.minAlpha = minAlpha;
        this.maxAlpha = maxAlpha;
    }

    /// add image data to histogram
    /**
     *  @param imageData ImageDataResult     
     */
    add_image(image: ImageData) {
        const data = image.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < this.minAlpha || a > this.maxAlpha) continue;
            const rq = Math.floor(r / this.q);
            const gq = Math.floor(g / this.q);
            const bq = Math.floor(b / this.q);
            const key = `${rq},${gq},${bq}`;
            if (!this.hist[key]) {
                this.hist[key] = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
            }
            this.hist[key].count += 1;
            this.hist[key].sumR += r;
            this.hist[key].sumG += g;
            this.hist[key].sumB += b;
        }        
    }

    get_result() {return Object.values(this.hist)};
}


export function findQuantizationAndGeneratePalette(imageData:ImageDataResult[], colors:number, minAlpha:number, maxAlpha:number
) : RGBPalette {

    let hist;
    for (let q = 64; q>7 ; q/=2) {
        const hstate = new HistogramState( q, minAlpha, maxAlpha);
        imageData.forEach(x=>hstate.add_image(x));
        hist = hstate.get_result();
        if (hist.length > colors) break;        
    }
    if (!hist) return [];
    
    hist.sort((a,b)=>b.count - a.count);

    if (hist.length > colors) {

        const main = hist.slice(0, colors);
        const remaining = hist.slice(colors);

        for (const rem of remaining) {
            let minDist = Infinity;
            let nearestIdx = -1;
            const remR = rem.sumR / rem.count;
            const remG = rem.sumG / rem.count;
            const remB = rem.sumB / rem.count;
            for (let i = 0; i < main.length; i++) {
                const mainColor = main[i];
                // Use average color for distance calculation
                const mainR = mainColor.sumR / mainColor.count;
                const mainG = mainColor.sumG / mainColor.count;
                const mainB = mainColor.sumB / mainColor.count;
                const dist = (mainR - remR) ** 2 + (mainG - remG) ** 2 + (mainB - remB) ** 2;
                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }
            if (nearestIdx >= 0) {
                main[nearestIdx].count += rem.count;
                main[nearestIdx].sumR += rem.sumR;
                main[nearestIdx].sumG += rem.sumG;
                main[nearestIdx].sumB += rem.sumB;
            }
        }
        hist = main;
    }

    // Return palette as average colors
    return hist.map(c => [
        Math.round(c.sumR / c.count),Math.round(c.sumG / c.count),Math.round(c.sumB / c.count)]
    ).sort((a,b)=> {
        const hsla=rgbToHsl(a as RGB);
        const hslb = rgbToHsl(b as RGB);
        if (hsla[1] < 0.2) {
            if (hslb[1] <0.2) {
                return hsla[2] - hslb[2];
            } else{
                return -1;
            }
        }
        if (hslb[1] < 0.2) {
            return 1;
        }
        return ((Math.round(hsla[0]*12)+hsla[2]) - (Math.round(hslb[0]*12)+hslb[2]));
    }) as RGBPalette;
}