import type { RGBPalette } from "./colors";
import { PCX } from "./pcx";


const icon_size = (2+2+2+2*256+55*45); //directly from C source

export class IconLib {
    
    icons: PCX[];

    constructor(icons: PCX[]) {
        this.icons = icons;
    }

    static fromArrayBuffer(buffer: ArrayBuffer) : IconLib{
        const count = buffer.byteLength/icon_size;
        const iconBuffers: ArrayBuffer[] = [];
        for (let i = 0; i < count; i++) {
            iconBuffers.push(buffer.slice(i * icon_size, (i + 1) * icon_size));
        }
        return new IconLib(iconBuffers.map(IconLib.parseBuffer));        
    }

    static parseBuffer(buffer:ArrayBuffer) : PCX {
        const view = new DataView(buffer);
        const width = view.getUint16(0, true);
        const height = view. getUint16(2, true);
        const flag = view.getUint16(4, true);

        if (width == 45 && height == 55 && flag == 8 ) {
            const pal = new Uint8Array(768);
            for (let i = 0; i < 256; ++i) {
                const hipal = view.getUint16(6+i*2, true);
                const r = ((hipal >> 10) & 0x1F) << 3;
                const g = ((hipal >> 5) & 0x1F) << 3;
                const b = (hipal & 0x1F) << 3;
                pal[i*3] = r;
                pal[i*3+1] = g;
                pal[i*3+2] = b;
            }
            const pixels = new Uint8Array(buffer, 518, 45 * 55);
            return new PCX(45,55,pixels,pal);
        } 
        return new PCX(45,55);
    }

    static constructArrayBuffer(source: PCX) : ArrayBuffer {
        const header = new Uint16Array(3+256);
        header[0] = 45;
        header[1] = 55;
        header[2] = 8;

        const pal :RGBPalette = source.get_palette();
        for (let i = 0 ; i < 256; ++i) {
            const p = pal[i];
            const hipal = ((p[0] & 0xF8) << 7) 
                    | ((p[1] & 0xF8) << 2) 
                    | ((p[2] & 0xF8) >> 3) ;
            header[i+3] = hipal;
        }
        
        const data = source.pixels;

        const buffer = new ArrayBuffer(header.byteLength + data.byteLength);
        const headerView = new Uint8Array(buffer, 0, header.byteLength);
        headerView.set(new Uint8Array(header.buffer));
        const dataView = new Uint8Array(buffer, header.byteLength, data.byteLength);
        dataView.set(data);
        return buffer;
        
    }

    toArrayBuffer(): ArrayBuffer {

            const buffers = this.icons.map(IconLib.constructArrayBuffer);
            const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const buf of buffers) {
                result.set(new Uint8Array(buf), offset);
                offset += buf.byteLength;
            }
            return result.buffer;

    }

}