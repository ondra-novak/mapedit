type Section = Record<string, string>;
type IniData = Record<string, Section>;

function encode_nl(s:string):string {
    const d =JSON.stringify(s);
    return d.substring(1,d.length-1).replaceAll("\\\"","\"");
}

function decode_nl(s:string):string {
    return JSON.parse(`"${s.replaceAll("\"","\\\"")}"`)
}

export class IniConfig {
    private data: IniData = {};

    constructor(initial?: string | IniData) {
        if (typeof initial === 'string') {
            this.load(initial);
        } else if (initial) {
            this.data = structuredClone(initial);
        }
    }

    load(input: string): void {
        this.data = {};
        let currentSection: string | null = null;

        const lines = input.split(/\r?\n/);

        for (let line of lines) {
            line = line.trim();

            if (!line || line.startsWith('#')) continue;

            // [sekce]
            if (line.startsWith('[') && line.endsWith(']')) {
                currentSection = line.slice(1, -1).trim();
                this.data[currentSection] ??= {};
                continue;
            }

            // klic=hodnota
            const eq = line.indexOf('=');
            if (eq !== -1 && currentSection) {
                const key = line.slice(0, eq).trim();
                const value = line.slice(eq + 1).trim();
                this.data[currentSection][key] = decode_nl(value);
            }
        }
    }

    save(): string {
        const lines: string[] = [];

        for (const [section, values] of Object.entries(this.data)) {
            lines.push(`[${section}]`);
            for (const [key, value] of Object.entries(values)) {
                lines.push(`${key}=${encode_nl(value)}`);
            }
            lines.push(''); 
        }

        return lines.join('\r\n')
    }

    get(section: string, key: string): string | undefined {
        return this.data[section]?.[key];
    }

    set(section: string, key_or_content: string|Record<string, any>, value?: string): void {
        this.data[section] ??= {};
        if (typeof key_or_content == "object") {
            this.data[section] = Object.assign(this.data[section], key_or_content);
        } else {
            this.data[section][key_or_content] = value || "";
        }

    }

    getSection(section: string): Section | undefined {
        return this.data[section];
    }

    toObject(): IniData {
        return this.data;
    }
}
