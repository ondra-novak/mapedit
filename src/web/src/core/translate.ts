
type FileRef = string;
type ItemRef = string;
type SubTable = Record<ItemRef, string>  //reference content
type MainTable = Record<FileRef, SubTable> //file - subtable


function csv_field(s:string) {
    return '"' + s.replace(/"/g, '""').replace(/\n/g, '\r\n') + '"';
}
function split_ignore_in_quotes(s: string, c: string) {
    return s.split(c).reduce((acc: string[], line: string) => {
            if (acc.length === 0) acc.push(line);
            else {
                const last = acc[acc.length - 1];
                const quoteCount = (last.match(/"/g) || []).length;
                if (quoteCount % 2 === 1) {
                    acc[acc.length - 1] = last + c + line;
                } else {
                    acc.push(line);
                }
            }
            return acc;
        }, []);    
}

export class TranslateTable {

    table: MainTable = {};


    openFile(f: FileRef) {
        return new class {
            owner: TranslateTable;
            file:FileRef
            constructor(owner:TranslateTable, f: FileRef) {
                this.owner = owner;
                this.file = f;
            }

            store(ref: ItemRef, s: string) {
                this.owner.store(this.file, ref, s);
            }
            translate(ref: ItemRef, name_or_string: string, object?: any) {
                const s = this.owner.load(this.file, ref);
                if (typeof object == "object" && object) {
                    if (s) object[name_or_string] = s;
                    return object[name_or_string];
                } else {
                    if (s) return s;
                    else return name_or_string;
                }
            }
        }(this, f);
    }

    load(file: FileRef, ref: ItemRef) {
        const a = this.table[file];
        if (!a) return null;
        const b = a[ref];
        if (!b) return null;
        return b;
    }

    store(file: FileRef, ref: ItemRef, s: string) {
        let a = this.table[file];
        if (!a) a = this.table[file] = {};
        a[ref] = s;
    }

    export_csv() {
        const lines = ["File,Node,Original,Translated"];
        for (const v in this.table) {
            const f = this.table[v];
            for (const w in f) {
                const r = f[w];
                const a1 = csv_field(v);
                const a2 = csv_field(w);
                const a3 = csv_field(r)
                lines.push(`${a1},${a2},${a3},`);
            }
        }
        const enc = new TextEncoder();
        return enc.encode(lines.join("\r\n")).buffer;
    }

    import_csv(x: ArrayBuffer) {
        const dec = new TextDecoder();
        const s = dec.decode(x).replaceAll("\r","");

        const table = split_ignore_in_quotes(s, "\n").map(row=>
            split_ignore_in_quotes(row,",").map(x=>{
                const y = x.trim();
                if (y.startsWith('"') && y.endsWith('"')) {
                    return y.substring(1, y.length-1).replace('""','"');                                        
                } else {
                    return y;
                }
            })            
        )

        const first_row = table.shift();
        if (!first_row)  throw new Error("File is empty");
        const file_index = first_row.indexOf("File");
        const node_index = first_row.indexOf("Node");
        const trans_index = first_row.indexOf("Translated");
        if (file_index < 0) throw new Error("Missing column 'File'");
        if (node_index < 0) throw new Error("Missing column 'Node'");
        if (trans_index < 0) throw new Error("Missing column 'Translated'");

        this.table = {};
        table.forEach(row=>{
            const f = row[file_index];
            const n = row[node_index];
            const t = row[trans_index];
            if (f && n && t)  {
                this.store(f,n,t);
            }
        });
    }

}