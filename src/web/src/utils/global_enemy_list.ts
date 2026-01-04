import { getDDLFileWithImport } from "@/components/tools/missingFiles";
import { server, type ModifiedFileNotify } from "@/core/api";
import {type WsRpcResult } from "@/core/wsrpc";
import { AssetGroup } from "@/core/asset_groups";
import { enemyFromArrayBuffer, type EnemyDef } from "@/core/enemy_struct";

let item_list : Promise<EnemyDef[]>|null = null;

async function globalGetEnemies() {

    if (!item_list) {
        item_list = getDDLFileWithImport(server, "ENEMY.DAT", AssetGroup.MAPS)
               .then(x=>x?enemyFromArrayBuffer(x):[],x=>[]);     
        const inv = (x: WsRpcResult)=>{
            const n : ModifiedFileNotify = x.data;
            if (n.name == "ENEMY.DAT") {
                item_list = null;
                server.off("modified", inv);
            }
        }
        server.on("modified", inv);
    }
    return await item_list;
}

export default globalGetEnemies;