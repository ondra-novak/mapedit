import type { RGB, RGBPalette } from "./colors";


export class ColorLUT {
    private palette: RGBPalette;
    private table: Uint16Array;
    private depth: number;

    constructor(palette: RGBPalette, depth: number = 5) {
        this.palette = palette;
        this.depth = depth;
        const size = 1 << depth; // 32 for 5 bits
        this.table = new Uint16Array(size * size * size);
        this.buildTable();
    }

    // Build the LUT table using BFS for faster nearest palette search
    private buildTable() {
        const size = 1 << this.depth;
        const visited = new Uint8Array(size * size * size);
        const queue: { r: number; g: number; b: number; idx: number }[] = [];

        // Seed the queue with palette colors mapped to the grid
        for (let i = 0; i < this.palette.length; i++) {
            const p = this.palette[i];
            const r = Math.round((p[0] / 255) * (size - 1));
            const g = Math.round((p[1] / 255) * (size - 1));
            const b = Math.round((p[2] / 255) * (size - 1));
            const index = this.getIndex(r, g, b);
            this.table[index] = i;
            visited[index] = 1;
            queue.push({ r, g, b, idx: i });
        }

        // 6-connected neighbors
        const dr = [1, -1, 0, 0, 0, 0];
        const dg = [0, 0, 1, -1, 0, 0];
        const db = [0, 0, 0, 0, 1, -1];

        while (queue.length > 0) {
            const { r, g, b, idx } = queue.shift()!;
            for (let d = 0; d < 6; d++) {
                const nr = r + dr[d];
                const ng = g + dg[d];
                const nb = b + db[d];
                if (
                    nr >= 0 && nr < size &&
                    ng >= 0 && ng < size &&
                    nb >= 0 && nb < size
                ) {
                    const nidx = this.getIndex(nr, ng, nb);
                    if (!visited[nidx]) {
                        this.table[nidx] = idx;
                        visited[nidx] = 1;
                        queue.push({ r: nr, g: ng, b: nb, idx });
                    }
                }
            }
        }
    }

    private getIndex(r: number, g: number, b: number): number {
        const size = 1 << this.depth;
        return r * size * size + g * size + b;
    }

    lookup(color: RGB): number {
        const size = 1 << this.depth;
        const r = Math.floor((color[0] / 256) * size );
        const g = Math.floor((color[1] / 256) * size );
        const b = Math.floor((color[2] / 256) * size );
        return this.table[this.getIndex(r, g, b)];
    }
}

