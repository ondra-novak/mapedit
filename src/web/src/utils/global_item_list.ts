import { getDDLFileWithImport } from "@/components/tools/missingFiles";
import { server } from "@/core/api";
import { AssetGroup } from "@/core/asset_groups";
import { itemsFromArrayBuffer, type ItemDef } from "@/core/items_struct";

let item_list : Promise<ItemDef[]> = Promise.resolve([]);
let expires = new Date();

async function globalGetItems(force_reload = false) {
    const now = new Date();
    if (force_reload || new Date() > expires) {
        item_list = getDDLFileWithImport(server,"ITEMS.DAT", AssetGroup.MAPS)
                .then(x=>x?itemsFromArrayBuffer(x):[],x=>[]);     
        expires = new Date(now.getTime() + 2000);
    }
    return item_list;
}

export default globalGetItems;