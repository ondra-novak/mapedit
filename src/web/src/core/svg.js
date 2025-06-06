export class SvgDrawing {
    constructor(svgElement) {
        if (svgElement instanceof SVGElement) {
            this.svg = svgElement;
        } else {
            this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        }
    }

    createElement(tagName, attributes = {}, className = "") {
        const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
        if (className) {
            element.setAttribute("class", className);
        }
        return element;
    }

    appendElement(element) {
        this.svg.appendChild(element);
        return this;
    }

    createRectangle(x, y, width, height, attributes = {}, className = "") {
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

    createText(x, y, textContent, attributes = {}, className = "") {
        const text = this.createElement("text", { x, y, ...attributes }, className);
        text.textContent = textContent;
        this.appendElement(text);
        return text;
    }

    getSvgElement() {
        return this.svg;
    }

    createGroup(attributes={}, className = "") {
        const group = this.createElement("g", { ...attributes }, className);
        return group;

    }

    clear() {
        while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    }
}

function round(n) {
     return Number(n).toFixed(2).replace(/\.?0+$/, "");
}

export class SvgPathBuilder {
    constructor(className = "", attributes = {}) {
        this.commands = [];
        this.attributes = attributes;
        this.className = className;
    }


    moveTo(x, y) {
        this.commands.push(`M ${round(x)},${round(y)}`);
        return this;
    }

    moveBy(dx, dy) {
        this.commands.push(`m ${round(dx)},${round(dy)}`);
        return this;
    }

    lineTo(x, y) {
        this.commands.push(`L ${round(x)},${round(y)}`);
        return this;
    }

    lineBy(dx, dy) {
        this.commands.push(`l ${round(dx)},${round(dy)}`);
        return this;
    }

    horizontalLineTo(x) {
        this.commands.push(`H ${round(x)}`);
        return this;
    }

    horizontalLineBy(dx) {
        this.commands.push(`h ${round(dx)}`);
        return this;
    }

    verticalLineTo(y) {
        this.commands.push(`V ${round(y)}`);
        return this;
    }

    verticalLineBy(dy) {
        this.commands.push(`v ${round(dy)}`);
        return this;
    }

    arcTo(rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y) {
        this.commands.push(`A ${round(rx)} ${round(ry)} ${round(xAxisRotation)} ${round(largeArcFlag)} ${round(sweepFlag)} ${round(x)} ${round(y)}`);
        return this;
    }

    circle(radius) {
        this.commands.push(`m 0,${-radius}`);
        this.commands.push(`a ${round(radius)} ${round(radius)} 0 1 1 0,${round(radius)}`);
        this.commands.push(`a ${round(radius)} ${round(radius)} 0 1 1 0,${-radius}`);
        return this;
    }

    bezierCurveTo(x1, y1, x2, y2, x, y) {
        this.commands.push(`C ${round(x1)} ${round(y1)}, ${round(x2)} ${round(y2)}, ${round(x)} ${round(y)}`);
        return this;
    }

    closePath() {
        this.commands.push("Z");
        return this;
    }

    empty() {
        return this.commands.length == 0;
    }

    build() {
        const pathData = this.commands.join(" ");
        const pathAttributes = { d: pathData, ...this.attributes };
        const svgDrawing = new SvgDrawing();
        return svgDrawing.createElement("path", pathAttributes, this.className);
    }
}

export class SvgTextGroupBuilder {
    constructor(className = "", attributes = {}) {
        this.texts = [];
        this.attributes = attributes;
        this.className = className;
    }

    add(x, y, textContent) {
        this.texts.push({ x, y, textContent});
        return this;
    }

    build() {
        const svgDrawing = new SvgDrawing();
        const group = svgDrawing.createElement("g", this.attributes, this.className);

        this.texts.forEach(({ x, y, textContent, attributes, className }) => {
            const textElement = svgDrawing.createText(x, y, textContent, attributes, className);
            group.appendChild(textElement);
        });

        return group;
    }

    empty() {
        return this.texts.length == 0;
    }
}

export class Transform2D {
    constructor(matrix) {
        if (!matrix) this.matrix = [1,0,0,1,0,0];
        else this.matrix = matrix;
    }

    translate(dx, dy) {
        // Apply translation by modifying the matrix
        this.matrix[4] += dx;
        this.matrix[5] += dy;
        return this;
    }

    rotate(degree) {
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

    transform(x, y) {
        // Apply the transformation matrix to the point (x, y)
        const [a, b, c, d, e, f] = this.matrix;
        const xPrime = a * x + c * y + e;
        const yPrime = b * x + d * y + f;
        return [xPrime, yPrime];
    }
}