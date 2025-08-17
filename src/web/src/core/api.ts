import { ref } from "vue";
import type { AssetGroupType } from "./asset_groups";
import Distributor from "./distributor";


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

export interface KeepAliveStatus {
    exit_on_close:boolean;
    keepalive_interval: number;
    game_instances: number;
    current_ddl: string;
}

export interface PutImageStatus {
    need: string;
    processed: boolean;
    error: string;
};

interface ArrayBufferWithBuffer extends ArrayBuffer {
    buffer: ArrayBuffer;
}

export class Config {
    project = "";    
}

export class ApiClient {
    

    keep_alive_event = ref<KeepAliveStatus|null>(null);
    keep_alive_interval = 5000;
    connected: boolean = false;

    constructor() {
        this.start_keepalive();
    }


    protected async handle_error(response:Response, message: string) {
            const text = await response.text(); // Může obsahovat chybovou hlášku
            throw new Error(`${message}. Status: ${response.status}. Message: ${text}`);
    }

    // DDL
    async getDDLFiles(group: number|null, source: string|null): Promise<DDLFiles> {
        const arg1=group?`group=${group}`:"";
        const arg2=source?`type=${source}`:"";
        const query = [`api/ddl`, [arg1,arg2].join('&')].join('?');
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
        const response = await fetch(`api/ddl/${encodeURIComponent(id)}`);
        if (response.ok) {
            const n = ((await response.bytes()).buffer);
            return n
        } else {
            throw Error("Get File Status: " + response.status);
        }
    }

    async getDDLMGFFile(id: string): Promise<ArrayBuffer> {
        const response = await fetch(`api/ddl/mgf/${encodeURIComponent(id)}`);
        if (response.ok) {
            const n = ((await response.bytes()).buffer);
            return n
        } else {
            throw Error("Get File Status: " + response.status);
        }
    }

    async putDDLFile(id: string, data: ArrayBuffer, group: number, fail_if_exists = false): Promise<boolean> {
        const response = await fetch(`api/ddl/${encodeURIComponent(id)}?group=${group}&fexists=${fail_if_exists?1:0}`, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: data
        });
       if (response.status !== 202) {
            if (response.status == 409) {
                return false;
            }
            await this.handle_error(response, "Failed to upload file.")        
       }
       return true;
    }    

    async deleteDDLFile(id: string): Promise<void> {
        const response = await fetch(`api/ddl/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
       if (response.status !== 202) {
            await this.handle_error(response, "Failed to erase file.")
       }
    }

    async compactDDL(): Promise<any> {
        const response = await fetch(`api/ddl/compact`, {
            method: "POST"
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Compact failed.")
        }
    }

    async mgfCreate(name: string, group: number, frames:number, transparent: boolean): Promise<string> {
        const response = await fetch(`api/ddl/mgf`, {
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
            await this.handle_error(response, "mfgCreate failed.")
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
            await this.handle_error(response, "mfgPutImage failed.")
        }
        return await response.json();
    }

    async mgfClose(session: string): Promise<string> {
        const response = await fetch(`api/mgf_session/${session}?a=close`, {
            method: "PUT",
        });
        if (response.status !== 201) {
            await this.handle_error(response, "mfgClose failed.")
        }
        return await response.text();
    } 

    async getDownloadLink(id:string):Promise<string> {
        return `api/ddl/${encodeURIComponent(id)}`;
    }

    async listAllDDLs() : Promise<DDLEntry[]> {
        const response   = await fetch("api/list") ;
        if (response.status != 200) {
            await this.handle_error(response, "List ddl failed.")
        }
        return ((await response.json()) as Record<string, any>[]).map(x=>({
            name: x.name,
            size: x.size,
            last_write: new Date(x.last_write*1000)
        }));
    }

    async keepalive() : Promise<KeepAliveStatus> {
        const response = await fetch("api/keepalive");
        if (response.status != 200) {
            await this.handle_error(response, "Keep alive failed.")
        }
        return await response.json();
    }

    async start_keepalive() {        
        try {
            const st = await this.keepalive();
            this.keep_alive_interval = st.keepalive_interval;
            this.keep_alive_event.value = st;
        } catch (e) {
            this.keep_alive_event.value = null;
        }
        setTimeout(()=>this.start_keepalive(), this.keep_alive_interval);
    }



    async game_client_start() : Promise<void>  {
        const response = await fetch(`api/game/start`, {
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            }
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Failed start game client")
        }
    }

    async game_client_stop() : Promise<void>  {
        const response = await fetch(`api/game/stop`, {
            method: "POST",
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Failed stop game client")
        }
    }

    async game_client_reload() : Promise<void>  {
        const response = await fetch(`api/game/reload`, {
            method: "POST",
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Failed reload game client")
        }
    }

    async game_client_show_console(show:boolean) : Promise<void>  {
        const response = await fetch(`api/game/console_show`, {
            method: "POST",
            body: show?"true":"false",
            headers: {
                "Content-Type":"application/json"
            }
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Failed reload show console")
        }
    }

    async game_client_console_exec(cmd:string) : Promise<void>  {
        const response = await fetch(`api/game/console_exec`, {
            method: "POST",
            body: cmd,
            headers: {
                "Content-Type":"text/plain"
            }
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Failed reload exec command on console")
        }
    }

    async game_client_teleport(map: string, sector: number, side: number) : Promise<boolean> {
        const response = await fetch(`api/game/teleport`, {
            method: "POST",
            body: JSON.stringify({
                map: map,
                sector: sector,
                side: side
            }),
            headers: {
                "Content-Type":"application/json"
            }
        });
        if (response.status === 409) {
            return false;
        } else if (response.status !== 202) {
            await this.handle_error(response, "Failed stop game client")
            return false;
        }
        return true;
    }

    async set_current_ddl(ddl: string) {
        const response = await fetch(`api/active`, {
            method: "PUT",
            body: ddl,
            headers: {
                "Content-Type":"text/plain"
            }
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Failed to store config")
            return false;
        }
        return true;
    }

}

export const server = new ApiClient();