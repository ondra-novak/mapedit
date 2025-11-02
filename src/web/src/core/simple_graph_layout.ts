

export type GridNode = {
    id: string;
    x: number;
    y: number;
    neighbors: string[];    
};

function xytokey(x:number, y:number) {
    return `${x},${y}`;
}

type Grid = Map<string, GridNode>;

// Počáteční jednoduché umístění uzlů do mřížky
function placeNodes(grid: Grid, nodes: GridNode[]): void {

    // Startovní uzel vlevo nahoře
    const startNode = nodes[0];
    startNode.x = 0;
    startNode.y = 0;
    grid.set(xytokey(0,0), startNode);

    const queue: GridNode[] = [startNode];
    const placed = new Set([startNode.id]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighborId of current.neighbors) {
            if (placed.has(neighborId)) continue;

            const neighbor = nodes.find(n => n.id === neighborId)!;

            // Najdi nejbližší volnou sousední buňku
            const dirs = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];

            const cx = current.x;
            const cy = current.y;
            let x = cx;
            let y = cy;
            let stepLen = 1;
            let dir = 0;
            let found = false;
            const maxSteps = 10000;
            let stepsTaken = 0;

            let key = xytokey(0,0);

            while (!found && stepsTaken < maxSteps) {
                for (let rep = 0; rep < 2 && !found; rep++) {
                    const [dx, dy] = dirs[dir];
                    for (let s = 0; s < stepLen && !found; s++) {
                        x += dx;
                        y += dy;
                        stepsTaken++;
                        key = xytokey(x, y);
                        if (!grid.has(key)) {
                            found = true;    
                        }
                        if (stepsTaken >= maxSteps) break;
                    }
                    dir = (dir + 1) % 4;
                }
                stepLen++;
            }
            grid.set(key, neighbor);
            neighbor.x = x;
            neighbor.y = y;
            queue.push(neighbor);
            placed.add(neighbor.id);
            found = true;          
        }
    }
}

// Jednoduchá optimalizace – přesouvání uzlů tak, aby byly hranice kratší
function optimizeGrid(grid: Grid, nodes: GridNode[], iterations: number = 100): void {

    function edgeLength(nodeA: GridNode, nodeB: GridNode) {
        return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
    }

    for (let it = 0; it < iterations; it++) {
        for (const node of nodes) {
            let bestX = node.x;
            let bestY = node.y;
            let bestScore = node.neighbors.reduce((acc, nid) => {
                const neighbor = nodes.find(n => n.id === nid)!;
                return acc + edgeLength(node, neighbor);
            }, 0);

            // Vyzkoušíme sousední buňky a zvolíme nejlepší
            const dirs = [
                [0, 1],
                [1, 0],
                [0, -1],
                [-1, 0],
            ];

            for (const [dx, dy] of dirs) {
                const nx = node.x + dx;
                const ny = node.y + dy;

                const key = xytokey(nx,ny);

                if (grid.has(key)) continue;

                // Spočítáme skóre
                const oldX = node.x;
                const oldY = node.y;
                node.x = nx;
                node.y = ny;
                const score = node.neighbors.reduce((acc, nid) => {
                    const neighbor = nodes.find(n => n.id === nid)!;
                    return acc + edgeLength(node, neighbor);
                }, 0);

                if (score < bestScore) {
                    bestScore = score;
                    bestX = nx;
                    bestY = ny;
                }

                node.x = oldX;
                node.y = oldY;
            }

            // Pokud lepší pozice existuje, přesuneme uzel
            if (bestX !== node.x || bestY !== node.y) {
                const old_key = xytokey(node.x, node.y);
                const new_key = xytokey(bestX, bestY);
                grid.delete(old_key)
                node.x = bestX;
                node.y = bestY;
                grid.set(new_key,node)
            }
        }
    }
}

function layoutGridChart(nodes: GridNode[]) {
    const g = new Map<string,GridNode>();
    placeNodes(g, nodes);
    optimizeGrid(g,nodes);
}

export default layoutGridChart;