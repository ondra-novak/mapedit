

export function bitproxy<T extends Record<string, number> > (definition:T, obj:any, field: string)  {  
    return new Proxy(definition,{
        get(def:T, prop:string) {
            const m = def[prop];
            if (m === undefined) return m;
            const shift = Math.log2(m & -m);
            const v = (obj[field] & m) >> shift;;
            if ((m & -m) == m) return v != 0;
            return v;
        },
        set(def:T, prop: string, val: number|boolean) {
            const bool_result  = prop.endsWith("_b");
            if (bool_result) prop = prop.substring(0,prop.length-2);
            if (typeof val == "boolean") val = val?1:0;
            const m = def[prop];
            if (m === undefined) return false;
            const shift = Math.log2(m & -m);
            const v = (val << shift) &  m;
            obj[field] = (obj[field] & ~m) | v;
            return true;
        }
    });
}

