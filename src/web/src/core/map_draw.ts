import { SVGDrawing, SVGPath, SvgTextGroupBuilder, Transform2D } from "@/utils/svg";
import { ActionType, SectorType, SideFlag, TMA_SEND_ACTION, type MapFile } from "./map_structs";
import type { ParsedBuildCommand } from "typescript";
import Distributor from "./distributor";





export function rectFromPoints(x1:number, y1:number, x2:number, y2:number): DOMRectReadOnly {
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    return new DOMRectReadOnly(x1,y1,x2-x1,y2-y1);
}


export class MapDraw {

    svg ?: SVGSVGElement;
    selection: SVGElement | null = null;
    rect_selction: SVGElement | null = null;
    focus: SVGElement | null = null;
    scale = 24;
    dim?: {width:number,height:number};
    layout: Record<string, number> = {};


    draw(m: MapFile, level: number) : SVGElement{

        const c = new SVGDrawing(this.svg);
        c.clear();
        this.layout = {};

        const set = {
            sector:{
                normal: new SVGPath("sector normal"),
                lava: new SVGPath("sector lava"),
                acid: new SVGPath("sector acid"),
                water: new SVGPath("sector water"),                
                stairs: new SVGPath("sectorfeat stairs"),
            },
            grid: {
                grid:new SVGPath("grid"),
            },
            sectorfeats :{
                flute_arrow: new SVGPath("sectorfeat flute"),
                pit: new SVGPath("sectorfeat pit"),
                column: new SVGPath("sectorfeat column"),
                button: new SVGPath("sectorfeat button"),
                buttonPressed: new SVGPath("sectorfeat button pressed "),
                death: new SVGPath("sectorfeat death"),
                ship: new SVGPath("sectorfeat ship"),
                lvplace: new SVGPath("sectorfeat lvplace"),
                teleport: new SVGPath("sectorfeat teleport"),
            },
            walls :{
                sound_impassable: new SVGPath("wall sound_impassable"), //sound can't pass (other can)
                sound_alarm: new SVGPath("wall alarm"),
                solid:  new SVGPath("wall solid"), //solid wall, but sector connected
                passable: new SVGPath("wall passable"), //solid wall, but passable for player
                pc_impassable: new SVGPath("wall impassable"),  //hidden wall, impassable for player
                enemy_only_passable: new SVGPath("wall enemy_only_passable"), //player cannot pass, but enemy can
                edge:  new SVGPath("wall edge"),  //edge wall - no sector behind
                secret: new SVGPath("wall secret"), //solid wall, but passable for player, market as secret
                niche: new SVGPath("wall niche")
            },
            arcs: {
                arc: new SVGPath("arc"),
            },
            action :{
                wall: new SVGPath("action wall"),
                script: new SVGPath("action script"),                
                button: new SVGPath("action button"),                
            },
            arrow :{
                same: new SVGPath("arrow same"),
                to_other:  new SVGPath("arrow out"),
                from_other: new SVGPath("arrow in"),
            },
            enemies: {
                placed: new SVGPath("enemy placed"),
                areas: new SVGPath("enemy impassable"), //enemy can't pass
                directions: new SVGPath("enemy direction"),
            },
            items: {
                placed: new SVGPath("items placed")
            }
        }
        

        const bbox = {left:999999,top:999999,right:-999999,bottom: -999999};

        const scl = this.scale;
        const sclp = scl>>1;


        m.sectors.forEach((s,sector)=>{
            if (sector == 0 || s.type == SectorType.Empty) return;
            const x = s.x*scl;
            const y = s.y*scl;

            if (x < bbox.left) bbox.left = x;
            if (x > bbox.right) bbox.right = x;
            if (y < bbox.top) bbox.top = y;
            if (y > bbox.bottom) bbox.bottom = y;


            if (s.level != level) {
                if (s.target_sector && m.sectors[s.target_sector].level == level) {
                    const ts = m.sectors[s.target_sector];
                    const mx = this.transformByDir(ts.x, ts.y, s.target_side);
                    if (mx) this.drawActionFromSector(set.arrow.from_other, s.x,s.y, mx);
                }
                s.side.forEach((sd,dir)=>{
                    const mx = this.transformByDir(s.x,s.y, dir);
                    if (!mx) return;
                    if (sd.target_sector) {
                        const ts = m.sectors[sd.target_sector];
                        if (ts.level == level) {
                            const smx = this.transformByDir(ts.x, ts.y, sd.target_side);
                            if (smx) {
                                this.drawActionFromWall(set.arrow.from_other,mx,smx);
                            }
                        }
                    }
                    if (sd.actions) {
                        sd.actions.forEach(ma=>{
                            if (ma.getAction() == ActionType.SENDA) {
                                const senda = ma as TMA_SEND_ACTION;
                                const ts = m.sectors[senda.sector];
                                if (senda.sector && ts.level == level) {
                                    const smx = this.transformByDir(ts.x, ts.y, senda.side);
                                    if (smx) {
                                        this.drawActionFromWall(set.arrow.from_other,mx,smx);
                                    }                                    
                                }
                            }
                        })
                    }

                });
                return;
            }


            this.layout[`${s.x},${s.y}`] = sector;

            let bgr = null;
            switch (s.type) {
                case SectorType.Empty: return;
                case SectorType.Acid: bgr = set.sector.acid;break;
                case SectorType.Button: bgr = set.sector.normal;
                                        set.sectorfeats.button.rctc(x,y,sclp, sclp);
                                        break;
                case SectorType.ButtonPressed:bgr = set.sector.normal;
                                        set.sectorfeats.buttonPressed.rctc(x,y,sclp, sclp);
                                        break;
                case SectorType.Column:bgr = set.sector.normal;
                                        set.sectorfeats.column.mt(x,y).circle(sclp>>1);
                                        break;
                case SectorType.DeathColumn:bgr = set.sector.normal;
                                        set.sectorfeats.death.rctc(x,y,sclp, sclp,45);
                                        break;
                case SectorType.DirectEnemyEast:
                                        bgr = set.sector.normal;this.drawArrow(set.enemies.directions,s.x,s.y,1);
                                        break;
                case SectorType.DirectEnemyNorth:
                                        bgr = set.sector.normal;this.drawArrow(set.enemies.directions,s.x,s.y,0);
                                        break;
                case SectorType.DirectEnemySouth:
                                        bgr = set.sector.normal;this.drawArrow(set.enemies.directions,s.x,s.y,2);
                                        break;
                case SectorType.DirectEnemyWest:
                                        bgr = set.sector.normal;this.drawArrow(set.enemies.directions,s.x,s.y,3);
                                        break;
                case SectorType.FluteEast:
                                        bgr = set.sector.normal;this.drawArrow(set.sectorfeats.flute_arrow,s.x,s.y,1);
                                        break;
                case SectorType.FluteNorth:
                                        bgr = set.sector.normal;this.drawArrow(set.sectorfeats.flute_arrow,s.x,s.y,0);
                                        break;
                case SectorType.FluteSouth:
                                        bgr = set.sector.normal;this.drawArrow(set.sectorfeats.flute_arrow,s.x,s.y,2);
                                        break;
                case SectorType.FluteWest:
                                        bgr = set.sector.normal;this.drawArrow(set.sectorfeats.flute_arrow,s.x,s.y,3);
                                        break;
                case SectorType.Lava:   bgr = set.sector.lava;break;
                case SectorType.LeavePlace: bgr=set.sector.normal;
                                        set.sectorfeats.lvplace.mt(x,y).circle(scl/3);
                                        break;
                case SectorType.Normal: bgr = set.sector.normal;break;
                case SectorType.Pit:    bgr=set.sector.normal;
                                        set.sectorfeats.pit.mt(x,y).circle(scl/3);
                                        break;
                case SectorType.Ship:   bgr = set.sector.water; 
                                        this.drawShip(set.sectorfeats.ship, x,y);
                                        break;
                case SectorType.Stairs: bgr = set.sector.normal;
                                        this.drawStairs(set.sector.stairs, x, y);
                                        break;
                case SectorType.Teleport: bgr = set.sector.normal;
                                        this.drawTeleport(set.sectorfeats.teleport, x, y);
                                        break;
                case SectorType.Water: bgr = set.sector.water;break;
                case SectorType.Whirpool: bgr = set.sector.water;
                                        set.sectorfeats.death.rctc(x,y,scl*0.5, scl*0.5,45);
                                        break;
                default: bgr = set.sector.normal;                
            }
            bgr.rctc(x,y,scl,scl);
            if (s.enemy) {
                this.drawArrow(set.enemies.placed, s.x, s.y, s.enemy.direction);
            }
            if (s.target_sector) {
                if (s.action) set.action.button.rctc(x,y,scl*0.25,scl*0.25,0);                
                if (s.target_sector != sector) {
                    const ts = m.sectors[s.target_sector];
                    const tmx = this.transformByDir(ts.x, ts.y, s.target_side);
                    if (tmx) {
                        this.drawActionFromSector(ts.level == level?set.arrow.same:set.arrow.to_other,s.x,s.y,tmx);
                    }
                }
            }
            s.exit.forEach((ex, dir)=> {
                const mx = this.transformByDir(s.x,s.y, dir);
                const sd = s.side[dir];
                const flgs = sd.flags;
                if (!mx) return;
                if (!ex) {
                    this.drawWall(set.walls.edge, mx);
                } else {
                    if (sd.primary && (flgs & SideFlag.PRIM_VIS)) {
                        //primary is visible
                        if ((flgs & SideFlag.SECRET) || (flgs & SideFlag.TRUESEE)) {
                            this.drawWall(set.walls.secret,mx);
                        } else if (!(flgs & SideFlag.PLAY_IMPS)) {
                            this.drawWall(set.walls.passable, mx);
                        } else if (!(flgs & SideFlag.MONST_IMPS)) {
                            this.drawWall(set.walls.enemy_only_passable,mx);
                        }
                        this.drawWall(set.walls.solid,mx);                        
                    } else {
                        if (flgs & SideFlag.PLAY_IMPS) {
                            this.drawWall(set.walls.pc_impassable, mx);                            
                        }
                        if (flgs & SideFlag.SOUND_IMPS) {
                            this.drawWall(set.walls.sound_impassable, mx);                            
                        }
                        if (flgs &SideFlag.ALARM) {
                            this.drawWall(set.walls.sound_alarm, mx);
                        }                        
                    }
                }
                if (sd.target_sector) {
                    if (sd.action) this.drawAction(set.action.wall, mx);
                    if (sd.target_sector != sector) {
                        const ts = m.sectors[sd.target_sector];
                        const tmx = this.transformByDir(ts.x, ts.y, sd.target_side);
                        if (tmx) {
                            this.drawActionFromWall(ts.level == level?set.arrow.same:set.arrow.to_other,mx,tmx);
                        }
                    }
                }
                if (sd.actions && sd.actions.length) {
                    this.drawAction(set.action.script, mx);
                    sd.actions.forEach(ma=>{
                        if (ma.getAction() == ActionType.SENDA) {
                            const senda = ma as TMA_SEND_ACTION;
                            if (senda.sector != sector && senda.sector) {
                                const ts = m.sectors[senda.sector];
                                const tmx = this.transformByDir(ts.x, ts.y, senda.side);
                                if (tmx) {
                                    this.drawActionFromWall(ts.level == level?set.arrow.same:set.arrow.to_other,mx,tmx);
                                }                                    
                            }
                        }
                    })
                }
                if (sd.items.length) {
                    this.drawItems(set.items.placed,mx);
                }
                if (sd.arc) {
                    if (flgs & SideFlag.LEFT_ARC) {
                        this.drawLeftArc(set.arcs.arc, mx);
                    }
                    if (flgs & SideFlag.RIGHT_ARC) {
                        this.drawRightArc(set.arcs.arc, mx);
                    }
                }
                if (sd.niche) {
                    this.drawNiche(set.walls.niche, mx);
                }
            });
        });

        const drw = new SVGDrawing;
        if (bbox.right < bbox.left) {
            bbox.left = bbox.right = bbox.top = bbox.bottom = 0;
        }
        const extend = scl * 10;
        const x = bbox.left - extend;
        const y = bbox.top - extend;
        const w = (bbox.right- bbox.left)+2*extend;
        const h = (bbox.bottom - bbox.top)+2*extend;
        for (let i = scl>>1; i <=w; i+=scl) set.grid.grid.mt((x+i), y).vr((h+1));        
        for (let i = scl>>1; i <=h; i+=scl) set.grid.grid.mt(x, (y+i)).hr((w+1));
        Object.values(set).forEach(x=>drw.appendSets(x));
        const svg = drw.getSvgElement()
        this.dim={width:w,height: h};
        svg.setAttribute("viewBox", `${x} ${y} ${this.dim.width} ${this.dim.height}`);
        this.svg = svg;        
        this.rect_selction = null;
        this.selection = null;
        this.focus = null;

        return this.svg;
    }

    drawSelectionBox(x1:number, y1:number, x2: number, y2:number) {
        if (this.svg) {
            const rc = rectFromPoints(x1,y1,x2,y2);
            const s = this.scale;
            const s2 = s>>1;
            if (this.rect_selction) {
                this.svg.removeChild(this.rect_selction);
            }
            if (rc.width == 0 || rc.height == 0)  this.rect_selction = SVGDrawing.createLine(rc.left*s-s2, rc.top*s-s2, rc.right*s-s2, rc.bottom*s-s2,{},"rect-selection");
            else this.rect_selction = SVGDrawing.createRectangle(rc.x*s-s2, rc.y*s-s2, rc.width*s, rc.height*s,{},"rect-selection");
            this.svg.appendChild(this.rect_selction);
        }
    }

    drawSelectedSectors(m: MapFile, level:number, sectors: number[]) {
        if (this.svg) {
            if (this.selection) {
                this.svg.removeChild(this.selection);
            }
            const p = new SVGPath("selection")
            const scl = this.scale;
            sectors.forEach(n=>{
                const s = m.sectors[n];
                if (s && s.level == level) {
                    const x= s.x*scl;
                    const y= s.y*scl;
                    p.rctc(x,y,scl,scl);                    
                }
            });
            this.selection = p.build();
            this.svg.append(this.selection);
        }
    }

    removeSelectionBox() {
        if (this.rect_selction) {
            this.svg?.removeChild(this.rect_selction);
            this.rect_selction = null;
        }
    }

    drawFocusedWall(m: MapFile, level: number, sector: number, side: number) {
        if (this.svg && side >= 0 && side < 4) { 
            if (this.focus) {
                this.svg.removeChild(this.focus);                
            }
            const p = new SVGPath("focus");
            const q = new SVGPath("focus-bgr");
            const w = new SVGPath("focus-itm");
            const scl = this.scale;
            const sect = m.sectors[sector];
            if (sect && sect.level == level) {
                const x = sect.x;
                const y = sect.y;
                const trn = this.transformByDir(x,y,side);
                if (trn) {                    
                    p.mt(...trn.xyof(0,0))
                     .lt(...trn.xyof(1,0))
                     .lt(...trn.xyof(1,0.2))
                     .lt(...trn.xyof(0,0.2))
                     .close();
                    p.mt(...trn.xyof(0.5,0.2))
                     .lt(...trn.xyof(0.4,0.5))
                     .lt(...trn.xyof(0.6,0.5))
                     .close();
                    q.rctc(...trn.xyof(0.5,0.5),this.scale,this.scale);
                    w.mt(...trn.xyof(0.25,0.25)).circle(0.2*this.scale);
                    this.focus = SVGDrawing.createElement("g");                    
                    this.svg.appendChild(this.focus);
                    this.focus.appendChild(q.build());
                    this.focus.appendChild(w.build());
                    this.focus.appendChild(p.build());
                    
                }
            }
        }
    }


    private drawStairs(p:SVGPath, x:number, y:number) {           
        const figure = [[2,0],[3,0],[3,3],[0,3],[0,2],[1,2],[1,1],[2,1]]
        const scale = this.scale*0.8/4;

        const mx = new Transform2D([scale,0,0,scale,x-scale*1.5,y-scale*1.5]);
        figure.forEach((pt, idx)=>{
            if (idx) p.lt(...mx.xyof(pt[0],pt[1]));
            else p.mt(...mx.xyof(pt[0],pt[1]));
        })
        p.close();
    }


    private drawShip(p:SVGPath, x: number, y:number) {
        const trup = [[2,10],[14,10],[12,13],[4,13]];
        const stezen = [[7.5,4],[8.5,4],[8.5,12],[7.5,12]];
        const plachta = [[8,4],[12,8],[8,8]];
        const scale = this.scale*0.8/16;
        const mx = new Transform2D([scale,0,0,scale,x-scale*8,y-scale*8]);
        [trup,stezen,plachta].forEach(x=>{
            x.forEach((pt, idx)=>{
                if (idx) p.lt(...mx.xyof(pt[0],pt[1]));
                else p.mt(...mx.xyof(pt[0],pt[1]));
            })
            p.close();
        })
    }


    private drawTeleport(p:SVGPath, x:number, y:number) {
        const figure = [[88.463, 26.181],
        [106.655, 73.963, 20.582, 103.707, 23.435, 59.721],
        [26.192, 37.31, 63.482, 29.341, 59.717, 44.827],
        [9.785, 75.319],
        [-8.407, 27.537, 77.667, -2.208, 74.814, 41.777],
        [72.057, 64.19, 34.767, 72.159, 38.531, 56.673]];
        const scale = this.scale/100;
        const mx = new Transform2D([scale,0,0,scale,x-scale*50,y-scale*50]);
        figure.forEach(cmd=>{
            if (cmd.length == 2) p.mt(...mx.xyof(cmd[0],cmd[1]));
            else p.bct(...mx.xyof(cmd[0],cmd[1]),...mx.xyof(cmd[2],cmd[3]),...mx.xyof(cmd[4],cmd[5]));
        })
    }

    private static drawArrowEx(path: SVGPath, matrix: Transform2D| null) {
        if (matrix) {
            path.mt(...matrix.xyof(0.5,0.2))
                .lt(...matrix.xyof(0.8,0.8))
                .lt(...matrix.xyof(0.5,0.7))
                .lt(...matrix.xyof(0.2,0.8))
                .close();
        }
    }
    
    private transformByDir(x:number, y:number, dir:number) {
        const scale =this.scale;
        x-=0.5;
        y-=0.5;
        switch (dir) {
            case 0:return  new Transform2D([scale,0,0,scale,x*scale,y*scale]);
            case 1:return  new Transform2D([0,scale,-scale,0,(x+1)*scale,y*scale]);
            case 2:return  new Transform2D([-scale,0,0,-scale,(x+1)*scale,(y+1)*scale]);
            case 3:return  new Transform2D([0,-scale,scale,0,x*scale,(y+1)*scale]);
        }
        return null;
    }
    
    private drawArrow(path:SVGPath, x:number, y:number, dir:number) {
        MapDraw.drawArrowEx(path, this.transformByDir(x,y,dir));
    }

    private drawWall(path: SVGPath, mx: Transform2D) {
        path.mt(...mx.xyof(0,0)).lt(...mx.xyof(1,0));
    }

    private drawAction(path: SVGPath, mx: Transform2D) {
        path.mt(...mx.xyof(0.25,0))
            .lt(...mx.xyof(0.75,0))
            .lt(...mx.xyof(0.5,0.25))
            .close();
    }
    private drawItems(path: SVGPath, mx: Transform2D) {
        if (!mx) return;
        const [xc,yc] = mx.xyof(0.25,0.25);
        path.mt(xc,yc).circle(this.scale * 0.2);
    }

    private drawLeftArc(path: SVGPath, mx: Transform2D) {
        if (!mx) return;
        const [xc,yc] = mx.xyof(0,0);
        const [xd,yd] = mx.xyof(0.2,0);
        path.mt(xc,yc).lt(xd,yd);
    }
    private drawRightArc(path: SVGPath, mx: Transform2D) {
        const [xc,yc] = mx.xyof(0.8,0);
        const [xd,yd] = mx.xyof(1,0);
        path.mt(xc,yc).lt(xd,yd);
    }
    private drawNiche(path: SVGPath, mx: Transform2D){
        path.mt(...mx.xyof(0.25,0))
            .lt(...mx.xyof(0.25,-0.25))
            .lt(...mx.xyof(0.75,-0.25))
            .lt(...mx.xyof(0.75,0));            
    }

    private drawBezierArrow(path: SVGPath, 
            x1:number, y1:number, x2:number, y2:number, angleStartRad:number, angleEndRad:number, weightStart=0.3, weightEnd=1.0) {

        const scale = this.scale;

        function normalizeAngle(angle:number) {
            return (angle + 2*Math.PI) % (2*Math.PI);
        }

        function angleDiff(a1:number, a2:number) {
            const diff = Math.abs(normalizeAngle(a1) - normalizeAngle(a2));
            return Math.min(diff, 2*Math.PI - diff);
        }


        function drawSingleCurve(x1:number, y1:number, x2:number, y2:number, angleStartRad:number, angleEndRad:number, weightStart=0.3, weightEnd=1.0) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const distance = Math.max(scale,Math.hypot(dx, dy));

            const d1 = distance * weightStart;
            const d2 = distance * weightEnd;

            const radStart = angleStartRad;
            const radEnd = angleEndRad;

            const cx1 = x1 + d1 * Math.cos(radStart);
            const cy1 = y1 + d1 * Math.sin(radStart);
            const cx2 = x2 + d2 * Math.cos(radEnd + Math.PI);
            const cy2 = y2 + d2 * Math.sin(radEnd + Math.PI);

            path.bct(cx1,cy1,cx2,cy2,x2,y2);

        }


        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.max(scale,Math.hypot(dx, dy));

        const mainAngle = Math.atan2(dy, dx);

        const angleStartNorm = normalizeAngle(angleStartRad);
        const angleEndNorm = normalizeAngle(angleEndRad);
        const mainAngleNorm = normalizeAngle(mainAngle);

        const oppAngle = normalizeAngle(mainAngleNorm + Math.PI);

        const isOppositeStart = angleDiff(angleStartNorm, oppAngle) < 0.1;
        const isOppositeEnd = angleDiff(angleEndNorm, oppAngle) < 0.1;

        path.mt(x1,y1);

        if (isOppositeStart || isOppositeEnd) {
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            const rad = (mainAngle + Math.PI/2);
            const offset = distance * 0.2;
            const ctrlX = midX + offset * Math.cos(rad);
            const ctrlY = midY + offset * Math.sin(rad);

            drawSingleCurve(x1, y1, ctrlX, ctrlY, angleStartRad, mainAngle, weightStart, 0.5);
            drawSingleCurve(ctrlX, ctrlY, x2, y2, mainAngle, angleEndRad, 0.5, weightEnd);
        } else {
            drawSingleCurve(x1, y1, x2, y2, angleStartRad, angleEndRad, weightStart, weightEnd);
        }
    }

    private drawArrowOnAction(path: SVGPath, amx:Transform2D) {
        path.mt(...amx.xyof(0.35,0.5))
            .lt(...amx.xyof(0.5,0))
            .lt(...amx.xyof(0.65,0.5))
            .close();
    }

    private drawActionFromWall(path: SVGPath, from: Transform2D, to:Transform2D) {
        const [xf,yf] = from.xyof(0.5,0.05);
        const [xft,yft] = from.xyof(0.5,0.5);
        const [xt,yt] = to.xyof(0.5,0.05);
        const [xtt,ytt] = to.xyof(0.5,0.5);

        const startRad = Math.atan2(yft-yf,xft-xf);
        const endRad = Math.atan2(yt-ytt, xt-xtt);
        this.drawBezierArrow(path, xf,yf,xt,yt, startRad,endRad,0.5);
        this.drawArrowOnAction(path, to.rotate(endRad))
        
    }

    private drawActionFromSector(path: SVGPath, x:number, y:number, to:Transform2D) {
        const [xt,yt] = to.xyof(0.5,0.05);
        const [xtt,ytt] = to.xyof(0.5,0.5);
        x*=this.scale;
        y*=this.scale;

        const startRad = Math.atan2(yt-y,xt-x);
        const endRad = Math.atan2( yt-ytt ,xt-xtt);
        this.drawBezierArrow(path, x,y,xt,yt, startRad,endRad);
        this.drawArrowOnAction(path, to.rotate(endRad))

        
    }
}


export class MapContainer {


    map: MapDraw | null = null;
    container: HTMLElement;
    scale = 1;
    scrollLeft = 0;
    scrollTop = 0;
    cursor = "default";

    onClickXY = (pt: DOMPointReadOnly, shift: boolean, control: boolean) => {
        console.log("Clicked at:" , pt, shift,control);
    };
    onSelectRect = (rc: DOMRectReadOnly,shift:boolean, control:boolean) => {
        console.log("Selected:", rc, shift, control);
    };

    constructor() {
        this.map = null;
        this.container = document.createElement("DIV");
        this.container.setAttribute("class","mapview");
        this.init_events();
    }

    set_cursor(cursor:string) {
        this.cursor = cursor;
        this.container.style.cursor = this.cursor;
    }

    add_to_DOM(new_parent: HTMLElement) {
        new_parent.appendChild(this.container);
        this.container.scrollLeft = this.scrollLeft;
        this.container.scrollTop = this.scrollTop;
    }

    get_element() {
        return this.container;
    }

    get_map() {
        return this.map;
    }

    get_scale() {
        return this.scale;
    }

    recalc() {
        if (!this.map || !this.map.dim) return;
        const svg = this.map.svg
        if (!svg) return;
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
            svg.style.left = "0";
        }
        if (cheight >= scaled_height) {
            svg.style.top = ((cheight-scaled_height)/2)+"px";
        } else {
            svg.style.top = "0";
        }
    }

    set_map(map: MapDraw) {
        const to_del = this.container.firstChild;
        this.map = map;
        const svg = map.svg;
        if (svg) this.container.appendChild(svg);
        if (to_del) this.container.removeChild(to_del);
        this.recalc();
        this.container.scrollLeft = this.scrollLeft;
        this.container.scrollTop = this.scrollTop;
    }

    /**
     * 
     * @param {number} new_scale 
     * @param {number} x 
     * @param {number} y 
     */
    set_zoom(new_scale: number, x:number, y:number) {
        if (new_scale < 0.1) new_scale = 0.1;
        if (new_scale > 10) new_scale = 10;
        const prev_zoom = this.scale;
        this.scale = new_scale;


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

    zoom_rel(step: number) {
        const rect = this.container.getBoundingClientRect();
        const px = (rect.right - rect.left)/2;
        const py = (rect.bottom - rect.top)/2;
        this.set_zoom(this.scale * Math.exp(step), px, py);
    }

    zoom_reset() {
        this.scale = 1;
        this.recalc();
        this.center();
    }

    init_events() {
        let dragButton = -1;
        let dragStart :number[]= [];
        let scroll = [];
        this.container.addEventListener('scroll',()=>{
            this.scrollLeft = this.container.scrollLeft;
            this.scrollTop = this.container.scrollTop;
        });
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
                            this.scrollLeft = this.container.scrollLeft = dragStart[2] - dx;
                            this.scrollTop = this.container.scrollTop = dragStart[3] - dy;
                        }  
                        else if (dragButton == 0) {
                            const pt1 = this.clientToMap([dragStart[0], dragStart[1]], true);
                            const pt2 = this.clientToMap([event.clientX,event.clientY], true);
                            this.map?.drawSelectionBox(...pt1,...pt2);
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
                        const pt = this.clientToMap([dragStart[0], dragStart[1]], false);
                        this.onClickXY(new DOMPointReadOnly(...pt), event.shiftKey, event.ctrlKey);
                    } else {
                        const pt1 = this.clientToMap([dragStart[0], dragStart[1]], true);
                        const pt2 = this.clientToMap([event.clientX,event.clientY], true);
                        this.map?.removeSelectionBox();
                        this.onSelectRect(rectFromPoints(...pt1,...pt2), event.shiftKey, event.ctrlKey);
                    
                    }                
                }              
                if (dragButton!=-1) {
                    dragStart = [];
                    this.container.style.cursor = this.cursor;   
                    dragButton = -1;
                    this.container.releasePointerCapture(event.pointerId);                    
                }
            }
            
        });
        this.container.style.cursor = this.cursor;
     }
    
    center() {
        const inner = this.container.firstChild as SVGSVGElement;
        if (inner) {
            const rect = this.container.getBoundingClientRect();
            const cwidth = rect.right - rect.left;
            const cheight = rect.bottom - rect.top;
            // Use the actual width/height of the SVG element (style, not bounding rect)
            const svgWidth = parseFloat(inner.style.width || "0");
            const svgHeight = parseFloat(inner.style.height || "0");
            this.scrollLeft = this.container.scrollLeft = Math.max(0, (svgWidth - cwidth) / 2);
            this.scrollTop = this.container.scrollTop = Math.max(0, (svgHeight - cheight) / 2);
        }
    }




    clientToMap(point :[number, number], vertex?: boolean) : [number,number]{
        if (this.map?.svg) {


            const pt = new DOMPointReadOnly(...point);
            const mx = this.map.svg.getScreenCTM();
            const ptt = pt.matrixTransform(mx?.inverse());
            const scale = this.map.scale;
            const shft = vertex?scale/2:0;
            return [Math.round((ptt.x+shft)/this.map.scale), Math.round((ptt.y+shft)/this.map.scale)];
        } else {
            return point
        }
    }
}


export function findSectorAtPos(m: MapFile, level: number , pt: DOMPointReadOnly) : number  {
    return m.sectors.findIndex(s=>{
        return Math.abs(s.x - pt.x) < 0.5 && Math.abs(s.y - pt.y) < 0.5 && s.level == level;
    })
}

export function makeSectorSelection(m: MapFile, level: number , rect: DOMRectReadOnly) : number[] {    
    return m.sectors.reduce((a,s,idx) => {
        if (s.level == level && rect.left-0.5 < s.x && rect.right+0.5 > s.x
                                && rect.top-0.5 < s.y && rect.bottom+0.5 > s.y) {
                                    a.push(idx);
                                }
        return a;
    },[] as number[]);
}




