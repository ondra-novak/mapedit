import type { ImageDataResult } from "./image_manip";


export type t_floor_map = {
    lineofs: number;
    linesize: number;
    counter: number;
    txtrofs: number;
};

export type t_all_view = {
    f_table: t_floor_map[][];
    c_table: t_floor_map[][];
};

export type t_point = {
    x: number;
    y: number;
};

export const zooming_points = [
    
     [620,349,10,3],
     [600,338,20,7],
     [580,327,30,11],
     [560,316,40,14],
     [540,305,50,18],
     [520,293,60,21],
     [500,282,70,25],
     [480,271,80,28],
     [460,259,90,31]
] as const;


const START_X1 = 357;
const START_Y1 = 305;
const START_X2 = 357;
const START_Y2 = -150;
const FACTOR_3D = 3.33;
const VIEW3D_X = 4;
const VIEW3D_Z = 5;
const MIDDLE_X = 320;
const MIDDLE_Y = 112;
const C_YMAP_SIZE = 90;
const F_YMAP_SIZE = 199;

export function calc_points() {
    // points[j][0][i] and points[j][1][i]
    // Structure: points[j][k][i] where k=0 or 1
    const points: t_point[][][] = [];
    for (let j = 0; j <= VIEW3D_X; j++) {
        points[j] = [[], []];
        let x1 = START_X1 + 2 * START_X1 * j;
        let y1 = START_Y1;
        let x2 = START_X2 + 2 * START_X1 * j;
        let y2 = START_Y2;
        for (let i = 0; i <= VIEW3D_Z; i++) {
            points[j][0][i] = { x: x1, y: y1 };
            points[j][1][i] = { x: x2, y: y2 };
            x2 = Math.round(x2 - x2 / FACTOR_3D);
            y2 = Math.round(y2 - y2 / FACTOR_3D);
            x1 = Math.round(x1 - x1 / FACTOR_3D);
            y1 = Math.round(y1 - y1 / FACTOR_3D);
        }
    }
    return points;
}

export const t_points = calc_points();

export interface Trapezoid {
    x1:number;
    x2:number;
    y12:number;
    x3:number;
    x4:number;
    y34:number;
}

function mapPoint(trpz: Trapezoid, x: number, y:number) : number[]{
    const { x1, x2, y12, x3, x4, y34 } = trpz;

    // Interpolate vertical position (v) between y12 and y34
    const v = (y - y12) / (y34 - y12);

    // Interpolate left and right x at this y
    const left = x1 + (x3 - x1) * v;
    const right = x2 + (x4 - x2) * v;

    // Interpolate horizontal position (u) between left and right
    const u = (x - left) / (right - left);

    return [ u, v ];
}

function mapFloorOrCeil(source: ImageDataResult, target: ImageDataResult, trap: Trapezoid) {

    const h = trap.y34 - trap.y12;
    let ya = trap.y12;
    let yb = trap.y34;
    if (ya > yb) {
        const c= ya; ya = yb-1; yb = c+1;        
    }
    for (let y = ya ; y < yb; ++y) {
        const f = (y - trap.y12)/h;
        let xa = Math.round(trap.x1 + (trap.x3 - trap.x1) * f);
        let xb = Math.round(trap.x2 + (trap.x4 - trap.x2) * f);
        if (xa > xb) {
            const c = xa; xa = xb; xb = c;
        }
        if (y >= 0 && y < target.height) {
            const tlofs = target.width * y * 4;
            for (let x = xa; x <= xb; ++x) {
                if (x >= 0 && x < target.width) {
                    const [xf, yf] = mapPoint(trap, x,y);
                    if (xf >= 0 &&  xf < 1 &&  yf >= 0 && yf < 1) {
                        const sx = Math.min(Math.floor(source.width * xf), source.width-1);
                        const sy = Math.min(Math.floor(source.height * yf), source.height-1);
                        
                        const srcofs = (sx + source.width * sy) * 4;
                        const trgofs =tlofs + x * 4;
                        target.data[trgofs+0] = source.data[srcofs+0];
                        target.data[trgofs+1] = source.data[srcofs+1];
                        target.data[trgofs+2] = source.data[srcofs+2];
                        target.data[trgofs+3] = source.data[srcofs+3];
                    }
                }
            }
        }
    }
}

export function createFloorCeil(source1: ImageDataResult, source2: ImageDataResult, target: ImageDataResult, type:"floor"|"ceil") {
    const c = type == "ceil";
    const top =c?0:360-target.height;
    const b = c?1:0;
    for (let z = 0; z < VIEW3D_Z; ++z) {
        const trpz1 = {
            y12: t_points[0][b][z+1].y + MIDDLE_Y - top,            
            y34: t_points[0][b][z].y + MIDDLE_Y - top,
            x1: MIDDLE_X - t_points[0][b][z+1].x ,
            x2: MIDDLE_X + t_points[0][b][z+1].x,
            x3: MIDDLE_X - t_points[0][b][z].x,
            x4: MIDDLE_X + t_points[0][b][z].x,
        }
        mapFloorOrCeil(z&1?source1:source2, target, trpz1);        
        for (let x = 0; x< VIEW3D_X; ++x) {
            trpz1.x1 = t_points[x][b][z+1].x + MIDDLE_X,
            trpz1.x2 = t_points[x+1][b][z+1].x + MIDDLE_X,
            trpz1.x3 = t_points[x][b][z].x + MIDDLE_X,
            trpz1.x4 = t_points[x+1][b][z].x + MIDDLE_X,
            mapFloorOrCeil((x+z+1)&1?source1:source2, target, trpz1);        
        }
        for (let x = 0; x< VIEW3D_X; ++x) {
            trpz1.x1 = MIDDLE_X - t_points[x+1][b][z+1].x,
            trpz1.x2 = MIDDLE_X - t_points[x][b][z+1].x ,
            trpz1.x3 = MIDDLE_X - t_points[x+1][b][z].x,
            trpz1.x4 = MIDDLE_X - t_points[x][b][z].x,
            mapFloorOrCeil((x+z+1)&1?source1:source2, target, trpz1);        
        }
    }
}

