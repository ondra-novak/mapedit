import type { AssetGroupType } from "./asset_groups";
import  WsRpcClient  from "./wsrpc"



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
}

export interface PutImageStatus {
    need: string;
    processed: boolean;
    error: string;
};

export interface KeepAliveData {
    exit_on_close:boolean;
    keepalive_interval: number;
    need_configure:boolean;
    game_instances: number;
    current_ddl: string;

}


interface ArrayBufferWithBuffer extends ArrayBuffer {
    buffer: ArrayBuffer;
}

export class Config {
    project = "";    
}

export class ApiClient extends WsRpcClient{

    
    async getDDLFiles(group:number|null = null, source:string|null = null) : Promise<DDLFiles> {
        const r:Record<string, any> = {};
        if (group) r.group = group;
        if (source) r.source = source;

        const out =  (await this.call("list_files", [r],[])).data;
        out.files = out.files.map((x:[string, string, boolean][])=>{
            return {
                name:x[0],
                group: x[1],
                ovr: x[2]
            };
        });
        return out;
    }

    async getDDLStats(): Promise<Stats> {
        return (await this.call("project_stats",[],[])).data;
    }

     async getDDLFile(id: string): Promise<ArrayBuffer> {
        return (await this.call("file_get", [id], [])).attachments[0];
/*        const response = await fetch(`api/ddl/${encodeURIComponent(id)}`);
        if (response.ok) {
            const n = ((await response.bytes()).buffer);
            return n
        } else {
            throw Error("Get File Status: " + response.status);
        }*/
    }


/*    ka_listeners: ((x: KeepAliveStatus)=>void)[] = [];
    last_ka = new KeepAliveStatus();

    keep_alive_interval = 5000;
    last_keep_alive_status = {}
    connected: boolean = false;
*/


    protected async handle_error(response:Response, message: string) {
            const text = await response.text(); // Může obsahovat chybovou hlášku
            throw new Error(`${message}. Status: ${response.status}. Message: ${text}`);
    }



    async getDDLMGFFile(id: string): Promise<ArrayBuffer> {
        return (await this.call("mgf_get",[id],[])).attachments[0];
    }

    async putDDLFile(id: string, data: ArrayBuffer, group: number, fail_if_exists = false): Promise<boolean> {
        return (await (this.call("file_put", [id, group, fail_if_exists],[data]))).data;
    }    

    async deleteDDLFile(id: string): Promise<boolean> {
        return (await (this.call("file_delete", [id],[]))).data;
    }

    async compactDDL(): Promise<any> {
        return (await (this.call("project_compact",[],[]))).data;
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


    async listAllDDLs() : Promise<DDLEntry[]> {
        return ((await this.call("project_list",[],[])).data as Record<string, any>[]).map(x=>({
            name: x.name,
            size: x.size,
            last_write: new Date(x.last_write*1000)
        }));
    }


    async game_client_start() : Promise<void>  {
        return (await this.call("preview_start",[],[])).data;        
    }

    async game_client_stop() : Promise<void>  {
        return (await this.call("preview_stop",[],[])).data;        
    }

    async game_client_reload() : Promise<void>  {
        return (await this.call("preview_reload",[],[])).data;        
    }

    async game_client_show_console(show:boolean) : Promise<void>  {
        return (await this.call("preview_console_show",[show],[])).data;
    }

    async game_client_console_exec(cmd:string) : Promise<void>  {
        return (await this.call("preview_console_exec",[cmd],[])).data;
    }

    async game_client_teleport(map: string, sector: number, side: number) : Promise<boolean> {
        return (await (this.call("preview_teleport",[{map,sector,side}],[]))).data;
    }

    async set_current_ddl(ddl: string) {
        return (await this.call("project_set_active",[ddl],[])).data;
    }

    async delete_ddl(ddl: string) {
        return (await this.call("project_delete",[ddl],[])).data;
    }

    async get_config():Promise<{game_dir:string, skeldal_ini:Record<string, any>} > {
        return (await (this.call("config_get",[],[]))).data;
    }

    async set_config(config: {
        game_dir:string;
        skeldal_ini:Record<string, any>
    }) {
        return (await (this.call("config_put",[config],[]))).data;
    }

}

export const server = new ApiClient();


