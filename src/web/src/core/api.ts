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

export interface DDLFiles {
    files: FileItem[];
    stats: Stats;
}


export class ApiClient {

    // DDL
    async getDDLFiles(group: number|null, source: string|null): Promise<DDLFiles> {
        const arg1=group?`group=${group}`:"";
        const arg2=source?`type=${source}`:"";
        const query = ["api/ddl", [arg1,arg2].join('&')].join('?');
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

    async getDDLFile(id: string): Promise<Uint8Array> {
        const response = await fetch(`api/ddl/${encodeURIComponent(id)}`);
        return response.bytes();
    }

    async putDDLFile(id: string, data: Uint8Array, group: number): Promise<void> {
        const response = await fetch(`api/ddl/${encodeURIComponent(id)}?group=${group}`, {
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
        const response = await fetch(`api/ddl/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
       if (response.status !== 202) {
            const text = await response.text(); // Může obsahovat chybovou hlášku
            throw new Error(`Failed to upload file. Status: ${response.status}. Message: ${text}`);
       }
    }

    async compactDDL(): Promise<any> {
        const response = await fetch(`api/ddl/compact`, {
            method: "POST"
        });
        return response.json();
    }

}

