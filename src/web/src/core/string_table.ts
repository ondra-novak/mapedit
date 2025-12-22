import { server } from "./api";
import { AssetGroup } from "./asset_groups";
import { enc2string, keybcs2string, string2keybcs } from "./keybcs2";
        
export function parse_stringtable(txt:string) : string[] {
    return txt.split('\n').map(x=>x.trim())
            .filter(x=>x.length && !x.startsWith(';'))
            .reduce((a,b)=>{
                const p = b.indexOf(' ');
                if (p == -1) return a;
                const idx = b.substring(0,p);
                const val = b.substring(p+1).trim();
                const idxval = parseInt(idx);
                if (isFinite(idxval) && idxval >= 0) {
                    a[idxval] = val;
                }
                return a;
            },[] as string[]);        
}


export function serialize_stringtable(ss:string[]) :string{
    const out = ss.reduce((a,txt,idx)=>{
        a.push(`${idx} ${txt}`);
        return a;
    },[] as string[]);
    out.push("-1");
    out.push("")
    const out2 = out.join("\n");
    return out2;
}

export function map_save_stringtable(mapname:string, ss:string[]): Promise<boolean> {
    const n1 = mapname.replace(/.MAP$/,".TXT");    
    const txt = serialize_stringtable(ss);
    const data = Uint8Array.from(string2keybcs(txt));
    return server.putDDLFile(n1, data.buffer, AssetGroup.MAPS, false);
}

export async function map_load_stringtable(s: string) : Promise<string[]> {
    const n1 = s.replace(/.MAP$/,".TXT");    
    try {
        const data = await server.getDDLFile(n1);        
        return parse_stringtable(keybcs2string(data));
    } catch (e) {
        const n2 = s.replace(/.MAP$/,".ENC");    
        try {
            const data = await server.getDDLFile(n2);        
            return parse_stringtable(enc2string(data));
        } catch (e) {
            return [];
        }
    }
    
    
}