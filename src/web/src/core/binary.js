import { string_from_keybcs2, keybcs2_from_string } from "./keybcs2.js";

export async function loadBinaryContent(url) {
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

export class BinaryIterator {
    constructor(binaryContent) {
        this.binaryContent = binaryContent;
        this.position = 0;
        this.dataView = new DataView(binaryContent.buffer);
    }


    parse_array(type, dimensions) {
        if (dimensions.length == 0) {
            return this.parse_type(type);
        }
        const r = [];
        const cnt = dimensions.shift();
        for (let i = 0; i < cnt; ++i)         {
            r.push(this.parse_array(type, dimensions));
        }
        return r;
    }

    parse_type(type) {
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
            const length = parseInt(type.match(/\d+/)[0], 10);
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
            result = string_from_keybcs2(chars);                
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

    parse(schema) {
        const result = {};
        for (const [n, type] of Object.entries(schema)) {
            try {
                result[n] = this.parse_type(type);
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

    readBytes(length) {
        const endPosition = Math.min(this.position + length, this.binaryContent.length);
        const bytes = this.binaryContent.slice(this.position, endPosition);
        this.position = endPosition;
        return bytes;
    }

    eof() {
        return this.position >= this.binaryContent.length;
    }

    parse_stringz() {
        const bytes = [];
        while (!this.eof()) {
            const byte = this.dataView.getUint8(this.position++);
            if (byte === 0) break; // Null-terminated
            bytes.push(byte);
        }        
        return string_from_keybcs2(bytes);
    }

}

export class BinaryWriter {
    constructor() {
        this.buffer = [];
    }

    write_array(type, dimensions, item) {
        if (dimensions.length == 0) {
            this.write_type(type,item);
        } else {
            const cnt = dimensions.shift();
            if (Array.isArray(item)) {
                for (let i = 0; i < cnt; ++i)         {
                    if (item.length < i) {
                        this.write_array(type, dimensions, item[i]);
                    } else {
                        this.write_array(type, dimensions, 0);
                    }
                }
            } else {
                for (let i = 0; i < cnt; ++i)         {
                    this.write_array(type, dimensions, 0);
                }
            }
        }
    }

    write_type(type, value)  {
        if (typeof type === 'object') {
            if (!Array.isArray(type)) {
                this.write(type, value);
            } else {
                let item_type = type[0];
                let dimensions = type.slice(1);
                this.write_array(item_type, dimensions, value);
            }
        } else if (type.startsWith('char[')) {
            const length = parseInt(type.match(/\d+/)[0], 10);
            const encodedChars = keybcs2_from_string(value);
            for (let i = 0; i < length; i++) {
                const charCode = i < encodedChars.length ? encodedChars[i] : 0;
                this.buffer.push(charCode);
            }
        } else {
            switch (type) {
                case 'int8':
                    this.buffer.push(value & 0xff);
                    break;
                case 'uint8':
                    this.buffer.push(value & 0xff);
                    break;
                case 'int16':
                    this.buffer.push(value & 0xff, (value >> 8) & 0xff);
                    break;
                case 'uint16':
                    this.buffer.push(value & 0xff, (value >> 8) & 0xff);
                    break;
                case 'int32':
                    this.buffer.push(
                        value & 0xff,
                        (value >> 8) & 0xff,
                        (value >> 16) & 0xff,
                        (value >> 24) & 0xff
                    );
                    break;
                case 'uint32':
                    this.buffer.push(
                        value & 0xff,
                        (value >> 8) & 0xff,
                        (value >> 16) & 0xff,
                        (value >> 24) & 0xff
                    );
                    break;
                case 'float32': {
                    const float32Array = new Float32Array([value]);
                    const uint8Array = new Uint8Array(float32Array.buffer);
                    this.buffer.push(...uint8Array);
                    break;
                }
                case 'float64': {
                    const float64Array = new Float64Array([value]);
                    const uint8Array = new Uint8Array(float64Array.buffer);
                    this.buffer.push(...uint8Array);
                    break;
                }
                default:
                    throw new Error(`Unsupported type: ${type}`);
            }
        }
    }

    write(schema, obj) {
        for (const [key, type] of Object.entries(schema)) {
            const value = obj[key];
            this.write_type(type, value);
        }
    }

    write_stringz(text) {
        const encoder = new TextEncoder('windows-1252'); // Replace 'windows-1252' with the desired encoding
        const encodedText = encoder.encode(text);
        this.buffer.push(...encodedText, 0); // Append the encoded text followed by a null terminator
    }

    getBuffer() {
        return new Uint8Array(this.buffer);
    }
}