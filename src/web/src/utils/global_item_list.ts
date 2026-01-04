import { getDDLFileWithImport } from "@/components/tools/missingFiles";
import { server, type ModifiedFileNotify } from "@/core/api";
import {type WsRpcResult } from "@/core/wsrpc";
import { AssetGroup } from "@/core/asset_groups";
import { itemsFromArrayBuffer, type ItemDef } from "@/core/items_struct";

let item_list : Promise<ItemDef[]>|null = null;

async function globalGetItems() {

    if (!item_list) {
        item_list = getDDLFileWithImport(server, "ITEMS.DAT", AssetGroup.MAPS)
               .then(x=>x?itemsFromArrayBuffer(x):[],x=>[]);     
        const inv = (x: WsRpcResult)=>{
            const n : ModifiedFileNotify = x.data;
            if (n.name == "ITEMS.DAT") {
                item_list = null;
                server.off("modified", inv);
            }
        }
        server.on("modified", inv);
    }
    return await item_list;
}

export default globalGetItems;