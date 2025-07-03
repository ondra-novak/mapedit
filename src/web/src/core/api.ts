import type { AssetGroupType } from "./asset_groups";


export interface FileItem {
  name: string;
  group: AssetGroupType;   // enum nebo číslo, 0 = vše
  ovr: boolean;
}

export interface Stats {
    directory_space: number;
    entries_reserved: number;
    entries_used: number;
    reserved_space: number;
    total_space: number;
    used_space: number;
}

export interface DDLEntry {
    name: string;
    size: number;
    last_write: Date;
}

export interface DDLFiles {
    files: FileItem[];
    stats: Stats;
}

export interface PutImageStatus {
    need: string;
    processed: boolean;
    error: string;
};

interface ArrayBufferWithBuffer extends ArrayBuffer {
    buffer: ArrayBuffer;
}

export class ApiClient {

    current_ddl: string = "";

    constructor() {
        const v = localStorage.getItem("current_ddl");
        if (v) this.set_current_ddl(v);
    }

    set_current_ddl(s:string) {
        localStorage.setItem("current_ddl", s);
        this.current_ddl = encodeURIComponent(s);
    }
    get_current_ddl() :string {return decodeURIComponent(this.current_ddl);}

    // DDL
    async getDDLFiles(group: number|null, source: string|null): Promise<DDLFiles> {
        const arg1=group?`group=${group}`:"";
        const arg2=source?`type=${source}`:"";
        const query = [`api/ddl/${this.current_ddl}`, [arg1,arg2].join('&')].join('?');
        const response = await fetch(query);
        const json = await response.json();
        json.files = json.files.map((x:[string, string, boolean][])=>{
            return {
                name:x[0],
                group: x[1],
                ovr: x[2]
            };
        });
        return json;
    }

    async getDDLFile(id: string): Promise<ArrayBuffer> {
        const response = await fetch(`api/ddl/${this.current_ddl}/{$this.${encodeURIComponent(id)}`);
        if (response.ok) {
            const n = ((await response.bytes()).buffer);
            return n
        } else {
            throw Error("Get File Status: " + response.status);
        }
    }

    async getDDLMGFFile(id: string): Promise<ArrayBuffer> {
        const response = await fetch(`api/ddl/${this.current_ddl}/mgf/${encodeURIComponent(id)}`);
        if (response.ok) {
            const n = ((await response.bytes()).buffer);
            return n
        } else {
            throw Error("Get File Status: " + response.status);
        }
    }

    async putDDLFile(id: string, data: ArrayBuffer, group: number): Promise<void> {
        const response = await fetch(`api/ddl/${this.current_ddl}/${encodeURIComponent(id)}?group=${group}`, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: data
        });
       if (response.status !== 202) {
            const text = await response.text(); // Může obsahovat chybovou hlášku
            throw new Error(`Failed to upload file. Status: ${response.status}. Message: ${text}`);
       }
    }    

    async deleteDDLFile(id: string): Promise<void> {
        const response = await fetch(`api/ddl/${this.current_ddl}/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
       if (response.status !== 202) {
            const text = await response.text(); // Může obsahovat chybovou hlášku
            throw new Error(`Failed to upload file. Status: ${response.status}. Message: ${text}`);
       }
    }

    async compactDDL(): Promise<any> {
        const response = await fetch(`api/ddl/${this.current_ddl}/compact`, {
            method: "POST"
        });
        if (response.status !== 202) {
            const text = await response.text(); // Může obsahovat chybovou hlášku
            throw new Error(`Compact failed. Status: ${response.status}. Message: ${text}`);
       }
    }

    async mgfCreate(name: string, group: number, frames:number, transparent: boolean): Promise<string> {
        const response = await fetch(`api/ddl/${this.current_ddl}/mgf`, {
            method: "POST",
            body: JSON.stringify({
                filename: name,
                frames: frames,
                transparent: transparent,
                group: group
            }),
            headers: {
                "Content-Type":"application/json"
            }
        });
        if (response.status !== 201) {
            const text = await response.text();
            throw new Error(`mgfCreate failed. Status: ${response.status}. Message: ${text}`);
        }
        return await response.text()
    }

    async mgfPutImage(session: string, pcx_data: ArrayBuffer):Promise<PutImageStatus> {
        const response = await fetch(`api/mgf_session/${session}?a=image`, {
            method: "PUT",
            body: pcx_data,
            headers: {
                "Content-Type":"application/octet-stream"
            }
        });
        if (response.status !== 202) {
            const text = await response.text();
            throw new Error(`mgfPutImage failed. Status: ${response.status}. Message: ${text}`);
        }
        return await response.json();
    }

    async mgfClose(session: string): Promise<string> {
        const response = await fetch(`api/mgf_session/${session}?a=close`, {
            method: "PUT",
        });
        if (response.status !== 201) {
            const text = await response.text();
            throw new Error(`mgfPutImage failed. Status: ${response.status}. Message: ${text}`);
        }
        return await response.text();
    } 

    getDownloadLink(id:string):string {
        return `api/ddl/${this.current_ddl}/${encodeURIComponent(id)}`;
    }

    async listAllDDLs() : Promise<DDLEntry[]> {
        const response   = await fetch("api/ddl") ;
        if (response.status != 200) {
            const text = await response.text();
            throw new Error(`listAllDDLs failed. Status: ${response.status}. Message: ${text}`);
        }
        return ((await response.json()) as Record<string, any>[]).map(x=>({
            name: x.name,
            size: x.size,
            last_write: new Date(x.last_write*1000)
        }));
    }

}

export const server = new ApiClient();