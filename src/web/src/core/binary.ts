import { keybcs2string, string2keybcs } from "./keybcs2";


export function make1DArray<T>(n:number, init: T|(()=>T)) : T[]{
    const r = [];
    if (typeof init == "function") {
        for (let i = 0; i < n; ++i) r[i] = (init as (()=>T))();
    } else {
        for (let i = 0; i < n; ++i) r[i] = init;
    }
    return r;
}

export function make2DArray<T>(i:number,j:number, init: T|(()=>T)):T[][] {
    return make1DArray<T[]>(i, ()=>{
        return make1DArray<T>(j, init);
    });
}
export function make3DArray<T>(i:number,j:number,k:number, init: T|(()=>T)):T[][][] {
    return make1DArray<T[][]>(i, ()=>{
        return make1DArray<T[]>(j, ()=>{
            return make1DArray<T>(k, init);
        });
    });
}

export async function loadBinaryContent(url:string) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        console.error('Error loading binary content:', error);
        throw error;
    }
}

type Digits1 = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Digits = "0" | Digits1;
type Integral = Digits1 | `${Digits1}${Digits}` | `${Digits1}${Digits}${Digits}`;
type CharArray = `char[${Integral}]`;


export type SchemaType = "int8"|"uint8"|"int16"|"uint16"|"int32"|"uint32"|"float32"|"float64"|CharArray;
export type SchemaArray = [Schema, number, ... number[]];
export type SchemaBitmapTk = "bitmap";
export type SchemaBitmap = [SchemaBitmapTk, SchemaType, Record<string, number>];

export interface SchemaObject {
    [key:string]: Schema;
};

export type Schema = SchemaType| SchemaArray | SchemaBitmap | SchemaObject;

        function demask(v:number, m:number) : number|boolean{
            if (m >= 0x80000000) return demask(v>>>1, m>>>1);
            const shift = Math.log2(m & -m);
            const vv = (v & m) >> shift;;
            if ((m & -m) == m) return  (vv != 0);
            return vv;
        }



export class BinaryIterator {

    binaryContent: ArrayBuffer;
    position: number;
    dataView:DataView;


    constructor(binaryContent:ArrayBuffer) {
        this.binaryContent = binaryContent;
        this.position = 0;
        this.dataView = new DataView(binaryContent);
    }


    parse_array(type:Schema, dimensions:number[]) : any[]{
        if (dimensions.length == 0) {
            return this.parse(type);
        }
        const r = [];
        const cnt = dimensions[0];
        dimensions = dimensions.slice(1);
        for (let i = 0; i < cnt; ++i) {
            r.push(this.parse_array(type, dimensions));            
        }
        return r;
    }


    parse_bitmap(v: number, bitmap: Record<string, number> ) {
        const out : Record<string, number|boolean> = {};

        for (const k in bitmap) {
            out[k] = demask( v, bitmap[k]);
        }
        return out;
    }

    tell() {
        return this.position;
    }

    seek_rel(x:number) {
        this.position = this.position+x;
    }

    parse(schema: Schema) : any{
        let result: any;
        if (typeof schema === 'object') {
            if (!Array.isArray(schema)) {
                result = {};
                for (const [n, type] of Object.entries(schema)) {
                    try {
                        result[n] = this.parse(type as Schema);
                    } catch (e) {
                        if (e instanceof RangeError) {
                            break;
                        } else {
                            throw e;
                        }
                    }
                }
                return result;
            } else {
                let item_type = schema[0];
                if (item_type == "bitmap") {  // ["bitmap", "type", {field: mask}]
                    const t = (schema as SchemaBitmap)[1];
                    const v = this.parse(t) as number;
                    result = this.parse_bitmap(v, (schema as SchemaBitmap)[2]);
                } else {
                    let dimensions = schema.slice(1);
                    result = this.parse_array(item_type as SchemaType, dimensions as number[])
                }
            }
        } else if (schema.startsWith('char[')) {
            const m = schema.match(/\d+/);
            if (m) {
                const length = parseInt(m[0], 10);
                const chars = [];
                for (let i = 0; i < length; i++) {
                    const charCode = this.dataView.getUint8(this.position++);
                    if (charCode === 0) {
                        ++i
                        while (i < length)   {
                            const c = this.dataView.getUint8(this.position++);
                            ++i;
                        }
                        break;
                        // Null-terminated
                    }
                    chars.push(charCode);
                }
                result = keybcs2string(chars);                
            }
        } else {
            switch (schema) {
                case 'int8':
                    result = this.dataView.getInt8(this.position);
                    this.position += 1;
                    break;
                case 'uint8':
                    result = this.dataView.getUint8(this.position);
                    this.position += 1;
                    break;
                case 'int16':
                    result = this.dataView.getInt16(this.position, true);
                    this.position += 2;
                    break;
                case 'uint16':
                    result = this.dataView.getUint16(this.position, true);
                    this.position += 2;
                    break;
                case 'int32':
                    result = this.dataView.getInt32(this.position, true);
                    this.position += 4;
                    break;
                case 'uint32':
                    result = this.dataView.getUint32(this.position, true);
                    this.position += 4;
                    break;
                case 'float32':
                    result = this.dataView.getFloat32(this.position, true);
                    this.position += 4;
                    break;
                case 'float64':
                    result = this.dataView.getFloat64(this.position, true);
                    this.position += 8;
                    break;
                default:
                    throw new Error(`Unsupported type: ${schema}`);
            }
        }
        return result;



    }

    readBytes(length:number) {
        const endPosition = Math.min(this.position + length, this.binaryContent.byteLength);
        const bytes = this.binaryContent.slice(this.position, endPosition);
        this.position = endPosition;
        return bytes;
    }

    eof() {
        return this.position >= this.binaryContent.byteLength;
    }

    parse_stringz() {
        const bytes = [];
        while (!this.eof()) {
            const byte = this.dataView.getUint8(this.position++);
            if (byte === 0) break; // Null-terminated
            bytes.push(byte);
        }        
        return keybcs2string(bytes);
    }

}

export class BinaryBuilder {
     #buf = new Uint8Array(1024);
     #length = 0;

     #grow(min: number) {
        let cap = this.#buf.length;
        while (cap < min) cap *= 2;

        const n = new Uint8Array(cap);
        n.set(this.#buf);
        this.#buf = n;
    }

    write(buff: ArrayBuffer|ArrayLike<number>|number) {
        if (typeof buff == "number") {
            let l = this.#length;
            if (l >= this.#buf.length) {
                this.#grow(l+1);
            }
            this.#buf.set([buff],l)
            this.#length = l+1;
            return;
        }

        const u8 = new Uint8Array(buff);
        const needed = this.#length + u8.length;

        if (needed > this.#buf.length) {
            this.#grow(needed);
        }

        this.#buf.set(u8, this.#length);
        this.#length += u8.length;
    }

    toUint8Array(): Uint8Array {
        return this.#buf.subarray(0, this.#length);
    }
}

export class BinaryWriter {

    buffer: BinaryBuilder = new BinaryBuilder();


    write_array(type:Schema, dimensions:number[], item:any) {
        if (dimensions.length == 0) {
            this.write(type,item);
        } else {
            const dim = dimensions.slice();
            const cnt = dim.shift() || 0;            
            if (Array.isArray(item)) {
                for (let i = 0; i < cnt; ++i)         {
                    if (item.length > i) {
                        this.write_array(type, dim, item[i]);
                    } else {
                        this.write_array(type, dim, 0);
                    }
                }
            } else {
                for (let i = 0; i < cnt; ++i)         {
                    this.write_array(type, dim, 0);
                }
            }
        }
    }

    write(schema:Schema, value:any)  {
        if (typeof schema === 'object') {
            if (!Array.isArray(schema)) {
                for (const [key, type] of Object.entries(schema)) {
                    const v = value[key];
                    this.write(schema[key], v);
                }
            } else {
                let item_type = schema[0];
                if (item_type == "bitmap") {  // ["bitmap", "type", {field: mask}]
                    const t = (schema as SchemaBitmap)[1] 
                    const v = this.create_bitmap((schema as SchemaBitmap)[2],value);
                    this.write(t, v);
                } else {
                    let dimensions = schema.slice(1) as number[];
                    this.write_array(item_type, dimensions, value);
                }
            }
        } else if (schema.startsWith('char[')) {
            const m = schema.match(/\d+/) || ["0"];
            const length = parseInt(m[0], 10);
            const encodedChars = string2keybcs(value);
            for (let i = 0; i < length; i++) {
                const charCode = i < encodedChars.length ? encodedChars[i] : 0;
                this.buffer.write(charCode);
            }
        } else {
            switch (schema) {
                case 'int8':
                    this.buffer.write(value & 0xff);
                    break;
                case 'uint8':
                    this.buffer.write(value & 0xff);
                    break;
                case 'int16':
                    this.buffer.write([value & 0xff, (value >> 8) & 0xff]);
                    break;
                case 'uint16':
                    this.buffer.write([value & 0xff, (value >> 8) & 0xff]);
                    break;
                case 'int32':
                    this.buffer.write([
                        value & 0xff,
                        (value >> 8) & 0xff,
                        (value >> 16) & 0xff,
                        (value >> 24) & 0xff]);
                    break;
                case 'uint32':
                    this.buffer.write([
                        value & 0xff,
                        (value >> 8) & 0xff,
                        (value >> 16) & 0xff,
                        (value >> 24) & 0xff]);
                    break;
                case 'float32': {
                    const float32Array = new Float32Array([value]);
                    const uint8Array = new Uint8Array(float32Array.buffer);
                    this.buffer.write(uint8Array);
                    break;
                }
                case 'float64': {
                    const float64Array = new Float64Array([value]);
                    const uint8Array = new Uint8Array(float64Array.buffer);
                    this.buffer.write(uint8Array);
                    break;
                }
                default:
                    throw new Error(`Unsupported type: ${schema}`);
            }
        }
    }

    create_bitmap(bitmap: Record<string, number>, value: Record<string, number|boolean>) {
        let out : number  = 0;
        for (const k in bitmap) {
            let val = value[k] || 0;
            if (typeof val == "boolean") val = val?1:0;
            const m = bitmap[k];
            const shift = Math.log2(m & -m);
            const v = (val << shift) &  m;
            out = out | v;
        }
        return out;
    }

    write_stringz(text : string) : void{
        const encoder = new TextEncoder();
        const encodedText = encoder.encode(text);
        this.buffer.write(encodedText);
        this.buffer.write(0); // Append the encoded text followed by a null terminator
    }

    getBuffer() : ArrayBuffer{
        return new Uint8Array(this.buffer.toUint8Array()).buffer;
    }

    write_buffer(buff : ArrayBuffer) {
        const s = new Uint8Array(buff);
        this.buffer.write(s);
    }
}

export function splitArrayBuffer(arr: ArrayBuffer , separator: number) : ArrayBuffer[]{
    const arr8 = new Uint8Array(arr);
  const result = [];
  let start = 0;

  for (let i = 0; i < arr8.length; i++) {
    if (arr8[i] === separator) {
      result.push(arr8.slice(start, i).buffer);
      start = i + 1;
    }
  }
  // přidáme poslední úsek (i když nekončí oddělovačem)
  if (start <= arr8.length) {
    result.push(arr8.slice(start).buffer);
  }
  return result;
}

export function joinUint8Arrays(arrays: ArrayBuffer[], separator : number) : Uint8Array<ArrayBuffer>{
  if (!Array.isArray(arrays) || arrays.length === 0) return new Uint8Array();

  const sep =  Uint8Array.from([separator]);

  const totalLength = arrays.reduce((sum, a) => sum + a.byteLength, 0) +
    sep.length * (arrays.length-1);

  const result  = new Uint8Array(new ArrayBuffer(totalLength));
  let offset = 0;

  arrays.forEach((arr:ArrayBuffer, index:number) => {
    result.set(new Uint8Array(arr), offset);
    offset += arr.byteLength;

    if (index < arrays.length - 1) {
      result.set(sep, offset);
      offset += sep.length;
    }
  });

  return result;
}

export interface SectionInfo {
    type: number;
    data: ArrayBuffer;
}

const section_header : Schema= {
    block: "char[8]",
    type: "uint32",
    size: "uint32",
    offs: "uint32"
}

export function parseSection(iter:BinaryIterator ) : SectionInfo {
    const hdr = iter.parse(section_header);
    if (hdr.block != "<BLOCK>") throw Error("Corrupted section in source file");
    const buff = iter.readBytes(hdr.size);
    return {
        type  : hdr.type,
        data: buff
    };
}

export function writeSection(target: BinaryWriter, type: number, data: ArrayBuffer) {
    const hdr = {
        block: "<BLOCK>",
        type: type,
        size: data.byteLength,
        offs: 0        
    };
    target.write(section_header, hdr);
    target.write_buffer(data);
    
}

