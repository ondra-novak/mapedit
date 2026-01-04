import { server } from "./api";
import type { MapSide } from "./map_structs";
import { PCX, PCXProfile } from "./pcx";

function build_wall_canvas(primary: HTMLCanvasElement|null, secondary: HTMLCanvasElement|null, sec_x:number, sec_y:number) {
    const out = document.createElement('canvas');
    if (primary) {
        out.width = primary.width;
        out.height = primary.height;
    } else {
        out.width = 500;
        out.height = 320;
    }

    const ctx = out.getContext('2d');
    if (!ctx) return out;

    ctx.clearRect(0, 0, out.width, out.height);

    if (primary) {
        ctx.drawImage(primary, 0, 0);
    }

    if (secondary) {
        // sec_x/sec_y are given with origin at left-bottom, and secondary's pivot is its center
        const drawX = sec_x - (secondary.width / 2);
        const drawY = out.height - sec_y - (secondary.height / 2);
        ctx.drawImage(secondary, drawX, drawY);
    }

    return out;
}

export async function preview_wall(wall: MapSide) {
    const p = wall.primary;
    const s = wall.secondary;
    let pc : HTMLCanvasElement | null = null;
    let sc : HTMLCanvasElement | null = null;
    if (p) {
        const pxmf = p.get_pixmaps()[0][0];
        try {
            pc = PCX.fromArrayBuffer(await server.getDDLFile(pxmf)).createCanvas(PCXProfile.wall);
        } catch (e) {
            console.error(e);
        }        
    }
    if (s) {
        const pxmf = s.get_pixmaps()[0][0];
        try {
            sc = PCX.fromArrayBuffer(await server.getDDLFile(pxmf)).createCanvas(PCXProfile.wall);
        } catch (e) {
            console.error(e);
        }        
    }
    return build_wall_canvas(pc,sc,wall.secondary?.offset_x || 0, wall.secondary?.offset_y || 0);
}