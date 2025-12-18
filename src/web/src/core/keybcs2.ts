const keybcs2_table = "ČüéďäĎŤčěĚĹÍľĺÄÁÉžŽôöÓůÚýÖÜŠĽÝŘťáíóúňŇŮÔšřŕŔ¼§«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
const keybcs2_rev_table = keybcs2_table.split("").reduce((a,b,idx)=>{
    a[b] = idx+128;
    return a;
},{} as Record<string, number>);

export function keybcs2string(buff: ArrayBuffer|number[]) {
    const bytes = new Uint8Array(buff);
    return Array.prototype.map.call(bytes,x=>{
        return x < 128?String.fromCodePoint(x):keybcs2_table[x-128];
    }).join("");
}


export function string2keybcs(s: string) {
    const bytes:number[] =[];
    const replacement = "?".codePointAt(0);
    for (let i = 0; i < s.length; ++i) {
        let cp = s.codePointAt(i) || 32;
        if (cp >= 128) cp = keybcs2_rev_table[String.fromCodePoint(cp)] || replacement;
        bytes.push(cp);
    }
    return bytes;
}

export function enc2string(buff: ArrayBuffer|number[]) {
    const bytes = new Uint8Array(buff);
    let last = 0;
    const decoded  = Array.prototype.map.call(bytes, x=>{
            last = (last + x) & 0xFF;
            return last;
    }) as number[];
    return keybcs2string(decoded);

}


