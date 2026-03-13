import type { AssetGroupType } from "./asset_groups";
import  WsRpcClient, { type WsRpcResult }  from "./wsrpc"



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
    overlay_mode: boolean;
}

export interface DDLFileHistory {
    revision: number;
    timestamp: Date|null;
};

export interface ModifiedFileNotify {
    name: string;
    group: number;
};

export class Config {
    project = "";    
};

export interface PublishState {
    publish_time: number;
    steam_id: number;
    licence: boolean;
};

export interface PublishSteamData {
    visibility: number;
    tags: string[];
}

export interface PublishContentData {
    title:string;
    description:string;
    update_lang:string;
    content_lang:string;
    base_lang:string;
    author:string;
};

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

     async getDDLFile(id: string, rev = 0): Promise<ArrayBuffer> {
        return (await this.call("file_get", [id, rev], [])).attachments[0];
     }

     async getDDLFileHistory(id: string): Promise<DDLFileHistory[]> {
        const d = (await this.call("file_history",[id],[])).data as number[][];
        return d.map(x=>{
            const r = x[0];
            const t = x[1];
            return {
                revision: r,
                timestamp: t?new Date(t*1000):null
            };
        })
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
        return (await this.call("mgf_create",[{            
                filename: name,
                frames: frames,
                transparent: transparent,
                group: group
            }],[])).data;
    }

    async mgfPutImage(session: string, pcx_data: ArrayBuffer):Promise<PutImageStatus> {
        return (await this.call("mgf_put_image", [session],[pcx_data])).data;
    }

    async mgfClose(session: string): Promise<string> {
        return (await this.call("mgf_close",[session],[])).data;
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

    async game_client_teleport(map: string, sector: number, side: number,ghost:number) : Promise<boolean> {
        return (await (this.call("preview_teleport",[{map,sector,side,ghost}],[]))).data;
    }
    async game_client_test_dialog(id: number) : Promise<boolean> {
        return (await (this.call("preview_test_dialog",[id],[]))).data;
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

    get_download_link(id:string, rev = 0): string {
        let s =  `api/ddl/${encodeURIComponent(id)}`;
        if (rev) s = s + `?rev=${rev}`;
        return s;
    }

    async copy_files(from: string, to:string, to_group: AssetGroupType, from_rev = 0) : Promise<boolean> {
        return (await this.call("file_copy",[from, to, to_group, from_rev],[])).data;
    }

    async get_publish_status() : Promise<PublishState> {
        return (await this.call("publish.status",[],[])).data;    }

    async set_publish_image(image: ArrayBuffer, content_type: string): Promise<boolean> {
        return (await this.call("publish.set_image",[content_type],[image])).data;;
    }
    async set_publish_hi_image(image: ArrayBuffer): Promise<boolean> {
        return (await this.call("publish.set_hi_image",[],[image])).data;;
    }
    async get_publish_image(): Promise<Blob|null> {
        const resp =  (await this.call("publish.get_image",[],[]));
        if (resp.data == null) return null;
        else return new Blob(resp.attachments, {type: resp.data});
    }
    async set_publish_steam_data(data: PublishSteamData) : Promise<boolean> {
        return (await this.call("publish.set_steam_data",[data],[])).data;
    }
    async get_publish_steam_data() : Promise<PublishSteamData> {
        return (await this.call("publish.get_steam_data",[],[])).data;
    }
    async set_publish_content_data(data: PublishContentData) : Promise<boolean> {
        return (await this.call("publish.set_content_data",[data],[])).data;
    }
    async publish_prepare(changelog: string) : Promise<boolean> {
        return (await this.call("publish.prepare",[changelog],[])).data;
    }
    async publish_prepared() : Promise<number> {
        return (await this.call("publish.publish_prepared",[],[])).data;
    }
    async is_overlay_mode(): Promise<boolean> {
        return (await this.call("is_overlay_mode",[],[])).data;
    }

    async lang_list() : Promise<string[]>{
        return (await this.call("lang.list",[],[])).data;
    }
    async lang_get(lang:string) : Promise<ArrayBuffer>{
        return (await this.call("lang.get",[lang],[])).attachments[0];
    }
    async lang_put(lang:string, content: ArrayBuffer) : Promise<boolean>{
        return (await this.call("lang.put",[lang],[content])).data;
    }
    async lang_delete(lang:string) : Promise<void>{
        await this.call("lang.delete",[lang],[]);
    }
    async lang_copyddl(target:string, ignore_files:string[]): Promise<void>{
        await this.call("lang.copyddl", [target, ignore_files],[]);
    }
    async can_import_adventure() : Promise<boolean> {
        return (await this.call("can_import_adventure", [],[])).data;
    }
    async import_adventure_as(s:string) : Promise<boolean> {
        return (await this.call("import_adventure_as", [s],[])).data;
    }

}

export const server = new ApiClient();


