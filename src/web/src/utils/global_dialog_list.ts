import { getDDLFileWithImport } from "@/components/tools/missingFiles";
import { server, type ModifiedFileNotify } from "@/core/api";
import {type WsRpcResult } from "@/core/wsrpc";
import { AssetGroup } from "@/core/asset_groups";
import { enemyFromArrayBuffer, Enemies } from "@/core/enemy_struct";
import { DialogManager } from "@/core/dialog_structs";

let dialog_list : Promise<[number, string][]> | null = null;

function reload(x: WsRpcResult) {
    const n : ModifiedFileNotify = x.data;
    if (n.name == "DIALOGY.JSON") {
        dialog_list = null;
        server.off("modified", reload);
    }
}

async function getGlobalDialogs() {

    if (!dialog_list) {        
        dialog_list = (async ()=>{
            const out : [number, string][] = [];
            try {
                const data = await server.getDDLFile("DIALOGY.JSON");
                server.on("modified",reload);
                let dlg = new DialogManager;
                const dec = new TextDecoder;
                dlg.load(dec.decode(data));
                for (const v in dlg._dlg) {
                    out.push([dlg.story_to_node(parseInt(v) ),dlg._dlg[v].name]);
                }
            } catch (e) {
            }        
            out.sort((a,b)=>a[1].localeCompare(b[1]))
            return out;
        })();
    }
    return await dialog_list;
}

export default getGlobalDialogs;