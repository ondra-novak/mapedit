

export function bitproxy<T extends Record<string, number> > (definition:T, obj:any, field: string) : Record<keyof T, boolean | number>  {  
    return new Proxy<Record<keyof T, boolean | number> >( {} as Record<keyof T, boolean | number> ,{
        get(_, prop:string) {
            const m = definition[prop];
            if (m === undefined) return m;
            const shift = Math.log2(m & -m);
            const v = (obj[field] & m) >> shift;;
            if ((m & -m) == m) return v != 0;
            return v;
        },
        set(_, prop: string, val: number|boolean) {
            if (typeof val == "boolean") val = val?1:0;
            const m = definition[prop];
            if (m === undefined) return false;
            const shift = Math.log2(m & -m);
            const v = (val << shift) &  m;
            obj[field] = (obj[field] & ~m) | v;
            return true;
        },
        has(_, prop: string) {
            return prop in definition;
        }
    });
}

