import { keybcs2_from_string, string_from_keybcs2 } from "./keybcs2";

class SkeldalStringtable {

    texts: string[] = [];

    load(file: ArrayBuffer) {
        const udata = new Uint8Array(file);
        const text = string_from_keybcs2(Array.from(udata));
        const lines = text.split("\n").map(x=>x.trim()).filter(x=>x && !x.startsWith(";") && !x.startsWith("-1"));
        this.texts = SkeldalStringtable.#extract_stringtable(lines);        
    }

    save() : ArrayBuffer {
        let text_file = "";
        const ln = this.texts.map((x,idx)=>`${idx} ${x.replace("\n","|").replace(/\s/," ")}`);
        ln.push("-1");
        ln.push("");
        text_file = ln.join("\n");        
        return Uint8Array.from(keybcs2_from_string(text_file)).buffer;
    }

    static #extract_stringtable(lines: string[]) : string[] {
        const result: string[] = [];
        for (const line of lines) {
            const match = line.match(/^(\d+)\s+(.+)$/);
            if (match) {
                const idx = parseInt(match[1], 10);
                const text = match[2].replace(/\|/g, '\n');
                result[idx] = text;
            }
        }
        return result;
    }

    get_empty_index(start = 0) : number{
        const l = this.texts.length;
        for (let i = start; i < l; ++i) {
            if (this.texts[i] === undefined) return i;
        }
        return l;
    }
}

export default SkeldalStringtable;