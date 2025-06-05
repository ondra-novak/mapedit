import { loadMap, SectorType, SideFlag } from "./map_format.js";
import { SvgDrawing, SvgPathBuilder, SvgTextGroupBuilder , Transform2D} from "./svg.js";
import Distributor from "./distributor.js";

const scale = 24;

export class Location {
    /**
     * 
     * @param {number} layer 
     * @param {number} sector 
     * @param {number} side 
     */
    constructor(layer, sector, side) {
        this.layer = layer;
        this.sector = sector;
        this.side = side;
    }
};
/**
 * 
 * @param {SvgPathBuilder} path 
 * @param {number} x 
 * @param {number} y 
 */
function drawSectorBox(path, x, y) {
    path.moveTo(x*scale,y*scale)
        .horizontalLineBy(scale)
        .verticalLineBy(scale)
        .horizontalLineBy(-scale)
        .closePath();
}

function drawButton(path, x, y) {
    path.moveTo((x+0.25)*scale,(y+0.25)*scale)
        .horizontalLineBy(0.5*scale)
        .verticalLineBy(0.5*scale)
        .horizontalLineBy(-0.5*scale)
        .closePath();
}



/**
 * 
 * @param {SvgPathBuilder} path 
 * @param {Transform2D} matrix 
 */
function drawArrowEx(path, matrix) {
    path.moveTo(...matrix.transform(0.5,0.2))
        .lineTo(...matrix.transform(0.8,0.8))
        .lineTo(...matrix.transform(0.5,0.7))
        .lineTo(...matrix.transform(0.2,0.8))
        .closePath();
}

function transformByDir(x, y, dir) {
    switch (dir) {
        case 0:return  new Transform2D([scale,0,0,scale,x*scale,y*scale]);
        case 1:return  new Transform2D([0,scale,-scale,0,(x+1)*scale,y*scale]);
        case 2:return  new Transform2D([-scale,0,0,-scale,(x+1)*scale,(y+1)*scale]);
        case 3:return  new Transform2D([0,-scale,scale,0,x*scale,(y+1)*scale]);
    }
    return null;
}

function drawArrow(path, x, y, dir) {
    drawArrowEx(path, transformByDir(x,y,dir));
}

/**
 * 
 * @param {SvgPathBuilder} path 
 * @param {number} x 
 * @param {number} y 
 */
function drawPit(path, x, y) {
    path.moveTo((x+0.5)*scale,(y+0.5)*scale).circle(0.4*scale);
}

function drawColumn(path, x, y) {
    path.moveTo((x+0.5)*scale,(y+0.5)*scale).circle(0.2*scale);
}

/**
 * 
 * @param {SvgTextGroupBuilder} group 
 * @param {number} x 
 * @param {number} y 
 * @param {string} text 
 */
function drawText(group,text, x, y) {
    group.add((x+0.5)*scale,(y+0.5)*scale, text);
}


/**
 * 
 * @param {SvgPathBuilder} path 
 * @param {number} x 
 * @param {number} y 
 */

function drawStairs(path, x, y) {           
/*
       +-+
       | |
     +-+ |
     |   |
   +-+   |
   |     |
   +-----+
*/
    path.moveTo((x+0.88)*scale,(y+0.12)*scale)
        .horizontalLineBy(-0.25*scale) //0.65
        .verticalLineBy(0.25*scale)    
        .horizontalLineBy(-0.25*scale) //0.40
        .verticalLineBy(0.25*scale)
        .horizontalLineBy(-0.25*scale) //0.15
        .verticalLineBy(0.25*scale)
        .horizontalLineBy(0.75*scale)
        .closePath();
}

function drawSide(path, x, y, side) {
    switch (side) {
        case 0: path.moveTo(x*scale,y*scale+1).horizontalLineBy(scale);break;
        case 1: path.moveTo((x+1)*scale-1,y*scale).verticalLineBy(scale);break;
        case 2: path.moveTo(x*scale,(y+1)*scale-1).horizontalLineBy(scale);break;
        case 3: path.moveTo(x*scale+1,y*scale).verticalLineBy(scale);break;
    }
}

function drawLeftArc(path, x, y, side, flags) {
    switch (side) {
        case 0: path.moveTo(x*scale,y*scale+1).horizontalLineBy(scale*0.3);                
                break;
        case 1: path.moveTo((x+1)*scale-1,y*scale).verticalLineBy(scale*0.3);
                break;
        case 2: path.moveTo((x+1)*scale,(y+1)*scale-1).horizontalLineBy(-scale*0.3);
                break;
        case 3: path.moveTo(x*scale+1,(y+1)*scale).verticalLineBy(-scale*0.3);   
                break;
    }
}



function drawRightArc(path, x, y, side, flags) {
    switch (side) {
        case 0: path.moveTo((x+1)*scale,y*scale+1).horizontalLineBy(-scale*0.3);
                break;
        case 1: path.moveTo((x+1)*scale-1,(y+1)*scale).verticalLineBy(-scale*0.3);
                break;
        case 2: path.moveTo(x*scale,(y+1)*scale-1).horizontalLineBy(scale*0.3);                
                break;
        case 3: path.moveTo(x*scale+1,y*scale).verticalLineBy(scale*0.3);
                break;
    }
}

function drawSelSide(path, matrix) {
        path.moveTo(...matrix.transform(0,0))
        .lineTo(...matrix.transform(1,0))
        .lineTo(...matrix.transform(1,0.1))
        .lineTo(...matrix.transform(0,0.1))
        .closePath()
        .moveTo(...matrix.transform(0.5,0.1))
        .lineTo(...matrix.transform(0.3,0.3))
        .lineTo(...matrix.transform(0.7,0.3))
        .closePath();

}

export function getMapBoundingBox(map) {
    let index = map.map.findIndex(s=>s.sector.type != SectorType.Empty);
    if (index == -1) return [0,0,0,0];
    let xmin = map.map[index].loc.x;
    let xmax = xmin;
    let ymin = map.map[index].loc.y;
    let ymax = ymin;

    map.map.forEach(s=>{
        if (s.sector.type == SectorType.Empty) return;
        if (s.loc) {            
            if (s.loc.x < xmin) xmin = s.loc.x;
            if (s.loc.x > xmax) xmax = s.loc.x;
            if (s.loc.y < ymin) ymin = s.loc.y;
            if (s.loc.y > ymax) ymax = s.loc.y;
        }        
    });
    return [xmin-1, ymin-1, xmax+1, ymax+1];

}

function make_rect(point1, point2) {
    return {
        left: Math.min(point1.x, point2.x),
        right: Math.max(point1.x, point2.x),
        top: Math.min(point1.y, point2.y),
        bottom: Math.max(point1.y, point2.y),
    }
}

/**
 * 
 * @param {ReturnType<typeof loadMap>} map 
 * @param {Array<number>} selected
 * @param {Location} location
 */
export function drawMap(map, selected, location) {
    const drw = new SvgDrawing();    
    const g = {
        normal_map:new SvgPathBuilder("normal"),
        text:new SvgTextGroupBuilder("text"),
        enemy_arrows:new SvgPathBuilder("enemyArrows"),
        water:new SvgPathBuilder("water"),
        lava:new SvgPathBuilder("lava"),
        acid:new SvgPathBuilder("acid"),
        flute_arrows:new SvgPathBuilder("fluteArrows"),
        black_shapes:new SvgPathBuilder("blackShapes"),
        black_hollow_shapes:new SvgPathBuilder("blackHollowShapes"),
        red_shapes:new SvgPathBuilder("redShapes"),
        leave_place:new SvgPathBuilder("leavePlace"),
        solid_walls:new  SvgPathBuilder("solidWalls"),
        arcs:new  SvgPathBuilder("arcs"),
        transp_walls:new  SvgPathBuilder("transparentWalls"),
        player_blocker:new  SvgPathBuilder("playerBlocker"),
        enemy_blocker:new  SvgPathBuilder("enemyBlocker"),
        sound_blocker:new  SvgPathBuilder("soundBlocker"),
        selectedArea:new SvgPathBuilder("selected"),
        items:  new  SvgTextGroupBuilder("items")
    };
    /*
    const items =
    */

    const sector_layout = {};
    map.map.forEach((s,idx)=>{        
        if (s.sector.type == SectorType.Empty) return;
        if (s.loc.layer != location.layer) return;
        switch (s.sector.type) {
            default: return;
            case SectorType.Normal: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);break;
            case SectorType.Acid: drawSectorBox(g.acid, s.loc.x, s.loc.y);break;
            case SectorType.Button: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawButton(g.black_hollow_shapes, s.loc.x, s.loc.y);
                                    break;
            case SectorType.ButtonPressed: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawButton(g.black_shapes, s.loc.x, s.loc.y);
                                    break;
            case SectorType.Column: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawColumn(g.black_shapes, s.loc.x, s.loc.y);
                                    break;
            case SectorType.DeathColumn: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawColumn(g.red_shapes, s.loc.x, s.loc.y);
                                    break;
            case SectorType.DirectEnemyNorth: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.enemy_arrows, s.loc.x, s.loc.y, 0);
                                    break;
            case SectorType.DirectEnemyEast: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.enemy_arrows, s.loc.x, s.loc.y, 1);
                                    break;
            case SectorType.DirectEnemySouth: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.enemy_arrows, s.loc.x, s.loc.y, 2);
                                    break;
            case SectorType.DirectEnemyWest: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.enemy_arrows, s.loc.x, s.loc.y, 3);
                                    break;
            case SectorType.FluteNorth:drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.flute_arrows, s.loc.x, s.loc.y, 0);
                                    break;
            case SectorType.FluteEast:drawSectorBox(normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.flute_arrows, s.loc.x, s.loc.y, 1);
                                    break;
            case SectorType.FluteSouth:drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.flute_arrows, s.loc.x, s.loc.y, 2);
                                    break;
            case SectorType.FluteWest:drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawArrow(g.flute_arrows, s.loc.x, s.loc.y, 3);
                                    break;
            case SectorType.Lava:   drawSectorBox(g.lava, s.loc.x, s.loc.y);break;
            case SectorType.Pit:    drawSectorBox(g.normal, s.loc.x, s.loc.y);
                                    drawPit(g.black_shapes, s.loc.x, s.loc.y);
                                    break;
            case SectorType.LeavePlace:drawSectorBox(g.normal, s.loc.x, s.loc.y);
                                    drawPit(g.leave_place, s.loc.x, s.loc.y);
                                    break;
            case SectorType.Ship:   drawSectorBox(g.water, s.loc.x, s.loc.y);
                                    drawText(g.text, "L", s.loc.x, s.loc.y)
                                    break;
            case SectorType.Stairs: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawStairs(g.black_shapes, s.loc.x, s.loc.y)
                                    break;
            case SectorType.Teleport: drawSectorBox(g.normal_map, s.loc.x, s.loc.y);
                                    drawText(g.text,"T", s.loc.x, s.loc.y)
                                    break;
            case SectorType.Water: drawSectorBox(g.water, s.loc.x, s.loc.y);                                    
                                    break;
            case SectorType.Whirpool:drawSectorBox(g.water, s.loc.x, s.loc.y);
                                    drawColumn(g.red_shapes, s.loc.x, s.loc.y);
                                    break;                                    
        }
        s.sector.exit.forEach((d,idx)=>{
            if (d == 0) drawSide(g.solid_walls, s.loc.x, s.loc.y, idx);
        });
        s.side.forEach((d,idx) => {
            if (s.sector.exit[idx]) {
                if (d.wall.flags & SideFlag.PLAY_IMPS) drawSide(g.player_blocker, s.loc.x, s.loc.y, idx);
                if (d.wall.flags & SideFlag.MONST_IMPS) drawSide(g.enemy_blocker, s.loc.x, s.loc.y, idx);
                if (d.wall.flags & SideFlag.SOUND_IMPS) drawSide(g.sound_blocker, s.loc.x, s.loc.y, idx);
                if (((d.wall.flags & SideFlag.PRIM_VIS) && d.wall.prim)
                    || ((d.wall.flags & SideFlag.SEC_VIS) && d.wall.sec)) {
                            drawSide(g.transp_walls, s.loc.x, s.loc.y, idx);
                    }
            }
            if (d.wall.flags & SideFlag.LEFT_ARC) drawLeftArc(g.arcs, s.loc.x, s.loc.y, idx);
            if (d.wall.flags & SideFlag.RIGHT_ARC) drawRightArc(g.arcs, s.loc.x, s.loc.y, idx);
            if (d.items) {
                let n = d.items.length;
                if (n > 9) n = 9;
                const mx = transformByDir(s.loc.x, s.loc.y, idx);
                const pt = mx.transform(0.25, 0.25);
                g.items.add(pt[0], pt[1], n);
            }

        });
        sector_layout[`${s.loc.x},${s.loc.y}`] = idx;
    });

    selected.forEach((idx)=>{
        if (map.map[idx]) {
            const loc = map.map[idx].loc;
            if (loc.layer == location.layer) {
                drawSectorBox(g.selectedArea, loc.x, loc.y);
            }
        }
    });

    for (const c in g) {
        if (!g[c].empty()) drw.appendElement(g[c].build());
    }


    const grpcntr = {
        grp: drw.createGroup(),
        set: function(sector, side){
            const drw = new SvgDrawing(this.grp);        
            drw.clear();
            if (this.map[sector]) {
                const loc = map.map[sector].loc;
                drw.createRectangle(loc.x*scale, loc.y*scale, scale, scale, {}, "selected");
                const currentWall = new SvgPathBuilder("currentWall");
                drawSelSide(currentWall, transformByDir(loc.x, loc.y, side));
                drw.appendElement(currentWall.build());
            }
        },
        clear: function() {
          (new SvgDrawing(this.grp)).clear();
        },
        map :map.map
    }
    grpcntr.set(location.sector, location.side);
    drw.appendElement(grpcntr.grp);

    const select_rect = {
        grp:drw.createGroup({},"select-rect"),
        set: function(x1,y1,x2,y2) {
            x1*=scale;
            y1*=scale;
            x2*=scale;
            y2*=scale;
            if (x1>x2) {const c = x1; x1 = x2; x2 = c};
            if (y1>y2) {const c = y1; y1 = y2; y2 = c};
            const drw = new SvgDrawing(this.grp);        
            drw.clear();
            if (x1 != x2 && y1 != y2) {
                drw.createRectangle(x1,y1,x2-x1,y2-y1);
            } else if (x1 == x2 || y1 == y2) {
                drw.createLine(x1,y1,x2,y2);
            }
        },
        clear: function() {
            (new SvgDrawing(this.grp)).clear();
        }
    }
    drw.appendElement(select_rect.grp);

    const svg = drw.getSvgElement();
    const bbox = getMapBoundingBox(map);
    let x = bbox[0]*scale;
    let y = bbox[1]*scale;
    let width = (bbox[2]*scale - x);
    let height = (bbox[3]*scale - y);

    let centerx = x+width/2;
    let centery = y+height/2;

    x-=width;
    y-=height;
    height+=height*2;
    width+=width*2;

    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    return {
        svg:svg,
        selection:select_rect,
        current: grpcntr,
        center: {x:centerx, y:centery},
        dim: {width: width, height: height},
        layout:sector_layout,
        level:location.layer,
    };
}

export class MapContainer {

    #dist = {
        single_select: new Distributor,
        multiple_select: new Distributor,
        draw_line: new Distributor
    }

    constructor(element) {
        this.map = null;
        this.container = element;
        this.container.style.position = "relative";
        this.container.style.overflow = "auto";
        this.scale = 0.5;
        this.init_events();
    }

    get_element() {
        return this.container();
    }

    get_map() {
        return this.map;
    }

    get_scale() {
        return this.scale;
    }

    recalc() {
        const svg = this.map.svg
        const scaled_width = this.map.dim.width*this.scale;
        const scaled_height = this.map.dim.height*this.scale;
        const rect = this.container.getBoundingClientRect();
        const cwidth = rect.right - rect.left;
        const cheight = rect.bottom - rect.top;        
        svg.style.position = "absolute";
        svg.style.width = scaled_width+"px";
        svg.style.height= scaled_height+"px";

        if (cwidth >= scaled_width) {
            svg.style.left = ((cwidth-scaled_width)/2)+"px";
        } else {
            svg.style.left = 0;
        }
        if (cheight >= scaled_height) {
            svg.style.top = ((cheight-scaled_height)/2)+"px";
        } else {
            svg.style.top = 0;
        }
    }

    set_map(map) {
        const to_del = this.container.firstChild;
        this.map = map;
        this.container.appendChild(map.svg);
        if (to_del) this.container.removeChild(to_del);
        this.recalc();
    }

    /**
     * 
     * @param {number} new_scale 
     * @param {number} x 
     * @param {number} y 
     */
    set_zoom(new_scale, x, y) {
        if (new_scale < 0.1) new_scale = 0.1;
        if (new_scale > 10) new_scale = 10;
        const prev_zoom = this.scale;
        this.scale = new_scale;

        const rect = this.container.getBoundingClientRect();
        const cwidth = rect.right - rect.left;
        const cheight = rect.bottom - rect.top;

        // Calculate scroll offset to keep (x, y) at the same place after zoom
        const scrollLeft = this.container.scrollLeft;
        const scrollTop = this.container.scrollTop;

        const relX = x + scrollLeft;
        const relY = y + scrollTop;

        const scale_ratio = new_scale / prev_zoom;

        const newRelX = relX * scale_ratio;
        const newRelY = relY * scale_ratio;

        this.recalc();

        this.container.scrollLeft = newRelX - x;
        this.container.scrollTop = newRelY - y;
    }

    init_events() {
        let dragButton = -1;
        let dragStart = [];
        let scroll = [];
        this.container.addEventListener('wheel', event => {
            event.preventDefault(); 

            const delta = event.deltaY;
            this.set_zoom(this.scale * Math.exp(delta*0.001), event.clientX, event.clientY);
        });
        this.container.addEventListener('pointerdown', event => {
            if (event.isPrimary) {
                event.preventDefault(); 
                if (dragButton!=-1) return;
                dragButton = event.button;
                dragStart = [event.clientX, event.clientY,this.container.scrollLeft, this.container.scrollTop,0];
            }
        });

        this.container.addEventListener('pointermove', event=>{
            if (event.isPrimary) {
                event.preventDefault(); 
                if (dragStart.length == 5) {
                    const dx = event.clientX - dragStart[0];
                    const dy = event.clientY - dragStart[1];
                    if (dx*dx > 25 || dy*dy > 25) {
                        dragStart[4] = 1;                        
                        this.container.style.cursor = dragButton?'grabbing':'crosshair';
                        this.container.setPointerCapture(event.pointerId);
                    }
                    if (dragStart[4]) {
                        if (dragButton == 1) {
                            this.container.scrollLeft = dragStart[2] - dx;
                            this.container.scrollTop = dragStart[3] - dy;
                        }  
                        else if (dragButton == 0) {
                            const pt1 = this.clientToMapLocationRound({x:dragStart[0],y:dragStart[1]});
                            const pt2 = this.clientToMapLocationRound({x:event.clientX,y:event.clientY});
                            const rect = make_rect(pt1,pt2);
                            this.map.selection.set(rect.left,rect.top,rect.right,rect.bottom);
                        }
                    }               
                }
            }
        });

        this.container.addEventListener('pointerup', event=>{
            if (event.isPrimary) {
                event.preventDefault(); 
                if (dragButton == 0) {
                    if (!dragStart[4]) {
                        const pt = this.clientToMapLocationFloor({x:event.clientX,y:event.clientY});
                        const sector = this.find_sector_at(pt.x,pt.y) || 0;
                        this.#dist.single_select.trigger({map:this.map,sector:sector,shift:event.shiftKey});
                    } else {
                        const pt1 = this.clientToMapLocationRound({x:dragStart[0],y:dragStart[1]});
                        const pt2 = this.clientToMapLocationRound({x:event.clientX,y:event.clientY});
                        const rect = make_rect(pt1,pt2);
                        const sectors = [];
                        let line = false;
                        if (rect.left == rect.right || rect.bottom == rect.top) {
                            line = true;
                            for (const s in this.map.layout) {
                                const [x, y] = s.split(',').map(Number);
                                if ((x >=rect.left && x < rect.right && y == rect.bottom && y == rect.top)
                                 || (x ==rect.left && x == rect.right && y < rect.bottom && y >= rect.top)) {                                    
                                        sectors.push(this.map.layout[s]);
                                }                            
                            }
                            this.#dist.draw_line.trigger({map:this.map,rect:rect, sectors:sectors, shift:event.shiftKey});
                        } else {
                            for (const s in this.map.layout) {
                                const [x, y] = s.split(',').map(Number);
                                if (x >=rect.left && y >= rect.top &&
                                    x < rect.right && y < rect.bottom) {
                                        sectors.push(this.map.layout[s]);
                                }                            
                            }
                            this.#dist.multiple_select.trigger({map:this.map,rect:rect, sectors:sectors, shift:event.shiftKey});
                        }
                        this.map.selection.clear();


                    }                
                }              
                if (dragButton!=-1) {
                    dragStart = [];
                    this.container.style.cursor = 'default';   
                    dragButton = -1;
                    this.container.releasePointerCapture(event.pointerId);                    
                }
            }
            
        });
    }
    
    center() {
        const rect = this.container.getBoundingClientRect();
        const cwidth = rect.right - rect.left;
        const cheight = rect.bottom - rect.top;
        this.container.scrollLeft = (this.map.dim.width * this.scale - cwidth) / 2;
        this.container.scrollTop = (this.map.dim.height * this.scale - cheight) / 2;
    }

    async on(what) {
        return await this.#dist[what].listen();
    }

    clientToMap(point /*:{x,y} */) {
        const svgRect = this.map.svg.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        const scale = this.scale;

        // Calculate the mouse position relative to the SVG element
        const svgX = (point.x - svgRect.left) / scale;
        const svgY = (point.y - svgRect.top) / scale;

        // Adjust for the SVG viewBox offset
        const viewBox = this.map.svg.viewBox.baseVal;
        return {
            x: svgX + viewBox.x,
            y: svgY + viewBox.y
        };
    }

    clientToMapLocationRound(point) {
        let pt = this.clientToMap(point);
        return {
            x:Math.round(pt.x/scale),
            y:Math.round(pt.y/scale)
        };
    }
    clientToMapLocationFloor(point) {
        let pt = this.clientToMap(point);
        return {
            x:Math.floor(pt.x/scale),
            y:Math.floor(pt.y/scale)
        };
    }
    find_sector_at(x,y) {
        return this.map.layout[`${x},${y}`];
    }

}



    
    

