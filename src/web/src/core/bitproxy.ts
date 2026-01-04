

export function bitproxy<T extends Record<string, number> > (definition:T, obj:any, field: string) : Record<keyof T, boolean | number>  {  
    return new Proxy<Record<keyof T, boolean | number> >( {} as Record<keyof T, boolean | number> ,{
        get(_, prop:string) {
            if (prop == "__isProxy") return true;
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


type Condition = {
    invert: boolean,
    cond: number|null,
}

export function condition_proxy(obj: any, field:string): Condition {

    function decompose(): Condition {
        const v = obj[field];
        return {invert: v < 0, cond: v?Math.abs(v)-1:null};
    }
    function compose(x : Condition) {
        obj[field] = (x.cond === null)?0:(x.invert?-1:1) * (x.cond+1);
    }

    return new Proxy<Condition> ( {} as Condition, {
        get(_,prop:string) {
           if (prop == "__isProxy") return true;
           const x = decompose();            
            return (x as Record<string, any>)[prop];
        },
        set(_, prop:string, newValue: any) {
            const x = decompose();
            if (prop in x) {
                const y = x as Record<string, any>;
                y[prop] = newValue;
                compose(x);
                return true;
            }
            return false;
        }
    });
}