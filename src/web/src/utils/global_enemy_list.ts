import { getDDLFileWithImport } from "@/components/tools/missingFiles";
import { server, type ModifiedFileNotify } from "@/core/api";
import {type WsRpcResult } from "@/core/wsrpc";
import { AssetGroup } from "@/core/asset_groups";
import { enemyFromArrayBuffer, Enemies } from "@/core/enemy_struct";

let enemy_list : Promise<Enemies>|null = null;

async function globalGetEnemies() {

    if (!enemy_list) {
        enemy_list = getDDLFileWithImport(server, "ENEMY.DAT", AssetGroup.MAPS)
               .then(x=>x?enemyFromArrayBuffer(x):new Enemies,x=>new Enemies);     
        const inv = (x: WsRpcResult)=>{
            const n : ModifiedFileNotify = x.data;
            if (n.name == "ENEMY.DAT") {
                enemy_list = null;
                server.off("modified", inv);
            }
        }
        server.on("modified", inv);
    }
    return await enemy_list;
}

export default globalGetEnemies;