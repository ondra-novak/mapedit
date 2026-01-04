import type { RGBPalette } from "./colors";

export type ImageDataResult = ImageData;

/**
 * Extracts dimensions and RGBA pixel data from an HTMLImageElement.
 * @param img HTMLImageElement
 * @returns Promise resolving to ImageDataResult
 */
export function extractImageData(img: HTMLImageElement): Promise<ImageDataResult> {
    return new Promise((resolve, reject) => {
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
    });
}


/**
 * Creates an RGB color histogram from image data.
 * @param imageData ImageDataResult
 * @param q Quantization factor for RGB channels
 * @param minAlpha Minimum alpha value (inclusive)
 * @param maxAlpha Maximum alpha value (inclusive)
 * @returns list of candidated colors
 */
export function createRgbHistogram(
    imageData: ImageDataResult,
    q: number,
    minAlpha: number,
    maxAlpha: number
): { count: number; sumR: number; sumG: number; sumB: number }[] {
    const hist: Record<string, { count: number; sumR: number; sumG: number; sumB: number }> = {};
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < minAlpha || a > maxAlpha) continue;
        const rq = Math.floor(r / q);
        const gq = Math.floor(g / q);
        const bq = Math.floor(b / q);
        const key = `${rq},${gq},${bq}`;
        if (!hist[key]) {
            hist[key] = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
        }
        hist[key].count += 1;
        hist[key].sumR += r;
        hist[key].sumG += g;
        hist[key].sumB += b;
    }
    return Object.values(hist);
}


export function findQuantizationAndGeneratePalette(imageData:ImageDataResult, colors:number, minAlpha:number, maxAlpha:number
) : RGBPalette {

    let hist;
    for (let q = 64; q>7 ; q/=2) {
        hist = createRgbHistogram(imageData, q, minAlpha, maxAlpha);
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
    );
}