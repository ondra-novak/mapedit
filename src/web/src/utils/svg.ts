function round(n:number):string {
     return Number(n).toFixed(2).replace(/\.?0+$/, "");
}

abstract class SVGSet {
    abstract build() : SVGElement;    
    abstract empty() : boolean;
    attributes: Record<string,string> = {}
    className: string = "";
    constructor(className = "", attributes = {}) {
        this.className = className;
        this.attributes = attributes;
    }
}

export class SVGPath extends SVGSet{
    commands : string[] = [];

    constructor(className = "", attributes = {}) {
        super(className, attributes);
    }


    mt(x:number, y:number) {
        this.commands.push(`M ${round(x)},${round(y)}`);
        return this;
    }

    mr(dx:number, dy:number) {
        this.commands.push(`m ${round(dx)},${round(dy)}`);
        return this;
    }

    lt(x:number, y:number) {
        this.commands.push(`L ${round(x)},${round(y)}`);
        return this;
    }

    lr(dx:number, dy:number) {
        this.commands.push(`l ${round(dx)},${round(dy)}`);
        return this;
    }

    ht(x:number) {
        this.commands.push(`H ${round(x)}`);
        return this;
    }

    hr(dx:number) {
        this.commands.push(`h ${round(dx)}`);
        return this;
    }

    rct(x:number, y:number, xs:number, ys:number) {
        return this.mt(x,y).hr(xs).vr(ys).hr(-xs).close();
    }
    rctc(x:number, y:number, xs:number, ys:number, rot:number = 0)  {
        const rotrad = Math.PI * rot /180;
        const xr = Math.cos(rotrad)*xs;
        const yr = Math.sin(rotrad)*ys;
        const yp = xr;
        const xp = -yr;
        this.mt(x-(xr+xp)/2, y-(yr+yp)/2).lr(xr,yr).lr(xp,yp).lr(-xr,-yr).close();
    }

    vt(y:number) {
        this.commands.push(`V ${round(y)}`);
        return this;
    }

    vr(dy:number) {
        this.commands.push(`v ${round(dy)}`);
        return this;
    }

    at(rx:number, ry:number, xAxisRotation:number, largeArcFlag:number, sweepFlag:number, x:number, y:number) {
        this.commands.push(`A ${round(rx)} ${round(ry)} ${round(xAxisRotation)} ${round(largeArcFlag)} ${round(sweepFlag)} ${round(x)} ${round(y)}`);
        return this;
    }

    circle(radius:number) {
        this.commands.push(`m 0,${round(-radius)}`);
        this.commands.push(`a ${round(radius)} ${round(radius)} 0 1 1 0,${round(2*radius)}`);
        this.commands.push(`a ${round(radius)} ${round(radius)} 0 1 1 0,${round(-2*radius)}`);
        return this;
    }

    bct(x1:number, y1:number, x2:number, y2:number, x:number, y:number) {
        this.commands.push(`C ${round(x1)} ${round(y1)}, ${round(x2)} ${round(y2)}, ${round(x)} ${round(y)}`);
        return this;
    }

    close() {
        this.commands.push("Z");
        return this;
    }

    empty() {
        return this.commands.length == 0;
    }

    build() : SVGElement {
        const pathData = this.commands.join(" ");
        const pathAttributes = { d: pathData, ...this.attributes };
        return SVGDrawing.createElement("path", pathAttributes, this.className);
    }
}

export class SvgTextGroupBuilder extends SVGSet {
    texts: {x:number; y:number; t: string}[] = [];
    constructor(className = "", attributes = {}) {
        super(className, attributes);
    }

    add(x:number, y:number, t:string) {
        this.texts.push({ x, y, t});
        return this;
    }

    build() {
        const group = SVGDrawing.createElement("g", this.attributes, this.className);

        this.texts.forEach(txt => {
            const textElement = SVGDrawing.createElement("text",{x:round(txt.x), y:round(txt.y),... this.attributes}, this.className);
            textElement.textContent = txt.t;
            group.appendChild(textElement);
        });

        return group;
    }

    empty() {
        return this.texts.length == 0;
    }
}

export class Transform2D {
    matrix: number[] = [1,0,0,1,0,0];

    constructor(matrix?:number[]) {        
        if (matrix) {
            const l = Math.min(matrix.length, this.matrix.length);
            for (let c = 0; c< l; ++c) {
                this.matrix[c] = matrix[c];
            }
        }
        
    }

    translate(dx:number, dy:number) {
        // Apply translation by modifying the matrix
        this.matrix[4] += dx;
        this.matrix[5] += dy;
        return this;
    }

    rotate(degree:number) {
        const radians = (degree * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);

        const [a, b, c, d, e, f] = this.matrix;

        this.matrix[0] = cos * a + sin * c;
        this.matrix[1] = cos * b + sin * d;
        this.matrix[2] = -sin * a + cos * c;
        this.matrix[3] = -sin * b + cos * d;

        return this;
    }

    xof(x:number,y:number) {
        const c = this.matrix;
        return c[0]*x+c[2]*y+c[4];
    }
    yof(x:number,y:number) {
        const c = this.matrix;
        return c[1]*x+c[3]*y+c[5];
    }
    xyof(x:number, y:number) : [number,number]{
        const c = this.matrix;
        return [c[0]*x+c[2]*y+c[4],c[1]*x+c[3]*y+c[5]];
    }    
 
}

export class SVGLayer extends SVGSet{
    items: SVGSet[] = [];

    constructor(className = "", attributes = {}) {
        super(className, attributes);    
    }

    add(svgset:SVGSet ) {
        this.items.push(svgset);
    }

    build(): SVGElement {
        const group = SVGDrawing.createElement("g", this.attributes, this.className);

        this.items.forEach(x=>{
            if (x.empty()) return;
            const el = x.build();
            group.appendChild(el);
        })
        return group;
    }

    empty(): boolean {
        return this.items.length == 0;
    }
}

export class SVGDrawing {

    svg: SVGSVGElement;

    constructor(svgElement?: SVGSVGElement) {
        if (svgElement) {
            this.svg = svgElement;
        } else {
            this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        }
    }

    static createElement(tagName: string, attributes : Record<string, string> = {}, className = "") {
        const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
        for (const key in attributes) {
            element.setAttribute(key, attributes[key]);
        }
        if (className) {
            element.setAttribute("class", className);
        }
        return element;
    }

    createElement(tagName: string, attributes : Record<string, string> = {}, className = "") {
        SVGDrawing.createElement(tagName,attributes, className);
        return this;
    }

    appendElement(element: SVGElement) {
        this.svg.appendChild(element);
        return this;
    }

    appendSets(set: SVGSet[] | Record<string, SVGSet>)  : SVGDrawing{
        if (Array.isArray(set)) {
            set.forEach((x : SVGSet) =>x.empty() ||  this.appendElement(x.build()));            
            return this;
        } else {
            return this.appendSets(Object.values(set));
        }
    }


/*    createRectangle(x, y, width, height, attributes = {}, className = "") {
        const rect = this.createElement("rect", { x, y, width, height, ...attributes }, className);
        this.appendElement(rect);
        return rect;
    }

    createCircle(cx, cy, r, attributes = {}, className = "") {
        const circle = this.createElement("circle", { cx, cy, r, ...attributes }, className);
        this.appendElement(circle);
        return circle;
    }

    createLine(x1, y1, x2, y2, attributes = {}, className = "") {
        const line = this.createElement("line", { x1, y1, x2, y2, ...attributes }, className);
        this.appendElement(line);
        return line;
    }

    createEllipse(cx, cy, rx, ry, attributes = {}, className = "") {
        const ellipse = this.createElement("ellipse", { cx, cy, rx, ry, ...attributes }, className);
        this.appendElement(ellipse);
        return ellipse;
    }

    createPolygon(points, attributes = {}, className = "") {
        const polygon = this.createElement("polygon", { points, ...attributes }, className);
        this.appendElement(polygon);
        return polygon;
    }

    createText(x, y, t, attributes = {}, className = "") {
        const text = this.createElement("text", { x, y, ...attributes }, className);
        text.textContent = t;
        this.appendElement(text);
        return text;
    }
        */

    getSvgElement() {
        return this.svg;
    }

    createGroup(attributes:Record<string,string>={}, className = "") {
        const group = this.createElement("g", { ...attributes }, className);
        return group;

    }

    clear() {
        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    }
}



