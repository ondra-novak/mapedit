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

    current_ddl: string = "";
    connect_change_event = new Distributor<boolean>();
    ddlchange_event = new Distributor<string>();
    gameconnect_event = new Distributor<number>();
    status: KeepAliveStatus = {exit_on_close:true, game_instances:0,keepalive_interval:5000};
    connected: boolean = false;

    constructor() {
        this.start_keepalive();
    }

    set_current_ddl(s:string) {
        const n = encodeURIComponent(s);
        if (n != this.current_ddl) {
            this.current_ddl = n;
            this.ddlchange_event.trigger(s);
        }
    }

    get_last_status() {return this.status;}

    get_current_ddl() :string {return decodeURIComponent(this.current_ddl);}

    protected async handle_error(response:Response, message: string) {
            const text = await response.text(); // Může obsahovat chybovou hlášku
            throw new Error(`${message}. Status: ${response.status}. Message: ${text}`);
    }

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
        const response = await fetch(`api/ddl/${this.current_ddl}/${encodeURIComponent(id)}`);
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
       }
    }    

    async deleteDDLFile(id: string): Promise<void> {
        const response = await fetch(`api/ddl/${this.current_ddl}/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
       if (response.status !== 202) {
            await this.handle_error(response, "Failed to upload file.")
       }
    }

    async compactDDL(): Promise<any> {
        const response = await fetch(`api/ddl/${this.current_ddl}/compact`, {
            method: "POST"
        });
        if (response.status !== 202) {
            await this.handle_error(response, "Compact failed.")
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

    getDownloadLink(id:string):string {
        return `api/ddl/${this.current_ddl}/${encodeURIComponent(id)}`;
    }

    async listAllDDLs() : Promise<DDLEntry[]> {
        const response   = await fetch("api/ddl") ;
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
            if (st.game_instances != this.status.game_instances) {
                this.gameconnect_event.trigger(st.game_instances);
            }
            this.status = st;
            if (!this.connected) {
                this.connect_change_event.trigger(true)
                this.connected = true;
            }
        } catch (e) {
            if (this.connected) {
                this.connect_change_event.trigger(false);
                this.connected = false;
            }
        }
        setTimeout(()=>this.start_keepalive(), this.status.keepalive_interval);
    }

    async get_config() : Promise<Config>{
        const response = await fetch("api/config");
        if (response.status != 200) {
            await this.handle_error(response, "get_config failed")
        }
        const r =await response.json();
        if (!r) return new Config();
        else return r;
    }

    async put_config(conf: Config): Promise<void> {
        const response = await fetch("api/config",{
            "method":"PUT",
            "headers": {
                "Content-Type":"application/json"
            },
            "body":JSON.stringify(conf)
        });
        if (response.status != 202) {
               await this.handle_error(response, "put_config failed")
        }
    }

}

export const server = new ApiClient();