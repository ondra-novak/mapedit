import { keybcs2string, string2keybcs } from "./keybcs2";


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

export type SchemaArray = readonly [Schema | string, number, ...number[]];

export interface Schema {
    [key: string]: string | SchemaArray | Schema;
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


    parse_array(type:string, dimensions:number[]) : any[]{
        if (dimensions.length == 0) {
            return this.parse_type(type);
        }
        const r = [];
        const cnt = dimensions[0];
        dimensions = dimensions.slice(1);
        for (let i = 0; i < cnt; ++i) {
            r.push(this.parse_array(type, dimensions));            
        }
        return r;
    }

    parse_type(type:string|Schema) : any{
        let result;
        if (typeof type === 'object') {
            if (!Array.isArray(type)) {
                result = this.parse(type);
            } else {
                let item_type = type[0];
                let dimensions = type.slice(1);
                result = this.parse_array(item_type, dimensions)
            }
        } else if (type.startsWith('char[')) {
            const m = type.match(/\d+/);
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
            switch (type) {
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
                    throw new Error(`Unsupported type: ${type}`);
            }
        }
        return result;

    }

    parse(schema: Schema) {
        const result: Record<string, any> = {};
        for (const [n, type] of Object.entries(schema)) {
            try {
                result[n] = this.parse_type(type as string | Schema);
            } catch (e) {
                if (e instanceof RangeError) {
                    break;
                } else {
                    throw e;
                }
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


    write_array(type:string | Schema, dimensions:number[], item:any) {
        if (dimensions.length == 0) {
            this.write_type(type,item);
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

    write_type(type:Schema| string| SchemaArray, value:any)  {
        if (typeof type === 'object') {
            if (!Array.isArray(type)) {
                this.write(type as Schema, value);
            } else {
                let item_type = type[0];
                let dimensions = type.slice(1) as number[];
                this.write_array(item_type, dimensions, value);
            }
        } else if (type.startsWith('char[')) {
            const m = type.match(/\d+/) || ["0"];
            const length = parseInt(m[0], 10);
            const encodedChars = string2keybcs(value);
            for (let i = 0; i < length; i++) {
                const charCode = i < encodedChars.length ? encodedChars[i] : 0;
                this.buffer.write(charCode);
            }
        } else {
            switch (type) {
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
                    throw new Error(`Unsupported type: ${type}`);
            }
        }
    }

    write(schema: Schema, obj:any) {
        for (const [key, type] of Object.entries(schema)) {
            const value = obj[key];
            this.write_type(type as Schema| string |SchemaArray, value);
        }
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

