

type Equal<T> = (c:T,d:T)=>boolean;

type Operation<T> = {
    op:"i"|"d"|"c";
    item?: T;
};

function walk_arrays<T>(a:T[], ofs_a: number, b: T[], ofs_b: number, eq: Equal<T>  ) : Operation<T>[] {
    if (ofs_a >= a.length) {
        if (ofs_b >= b.length) {
            return [];
        } else {
            const r = walk_arrays<T>(a,ofs_a, b, ofs_b+1, eq);
            r.push({op:"i",item:b[ofs_b]});
            return r;
        }
    } else if (ofs_b > b.length) {
        const r = walk_arrays<T>(a,ofs_a+1, b, ofs_b, eq);
        r.push({op:"d", item:a[ofs_b]});
        return r;
    } else {
        const are_eq = eq(a[ofs_a],b[ofs_b]);        
        if (are_eq) {
            const r = walk_arrays<T>(a,ofs_a+1, b, ofs_b+1, eq);            
            r.push({op:"c"});
            return r;
        } else {
            let r1 = walk_arrays<T>(a, ofs_a+1, b, ofs_b, eq);
            let r2 = walk_arrays<T>(a, ofs_a, b, ofs_b+1, eq);
            let c1 = r1.reduce((a,b)=>a+((b.op=="c")?1:0),0)
            let c2 = r2.reduce((a,b)=>a+((b.op=="c")?1:0),0)
            if (c2 > c1) {
                r2.push({op:"i",item:b[ofs_b]});
                return r2;
            } else {
                r1.push({op:"d",item:a[ofs_a]});
                return r1;
            }
        }
    }
}

export function create_array_diff<T>(a: T[], b: T[], eq:Equal<T>) {
    return walk_arrays(a, 0, b, 0, eq).reverse();
}

export function apply_array_diff<T>(a: T[], diff: Operation<T>[], eq: Equal<T>) : T[] {
    const out : T[] = [];
    let idx = 0;
    let has_del = false;
    diff.forEach(op=>{
        if (op.op == "c") {
            if (idx < a.length) {
                out.push(a[idx]);
                ++idx;
            }
        } else if (op.op == "d" ) {
            if (idx < a.length) {
                if (!eq(op.item!, a[idx])) {
                    out.push(a[idx]);
                }
                ++idx;
            }            
        } else {
            out.push(op.item!);
        }
    });
    while (idx < a.length) {
        out.push(a[idx]);
        ++idx;
    }
    return out;
}