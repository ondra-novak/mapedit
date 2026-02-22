import { server, type ModifiedFileNotify } from "@/core/api";
import {type WsRpcResult } from "@/core/wsrpc";
import { shopsFromArrayBuffer } from "@/core/shop_structs";

let shop_list : Promise<[number, string][]> | null = null;

function reload(x: WsRpcResult) {
    const n : ModifiedFileNotify = x.data;
    if (n.name == "SHOPS.DAT") {
        shop_list = null;
        server.off("modified", reload);
    }
}

async function getGlobalShops() {

    if (!shop_list) {        
        shop_list = (async ()=>{
            const out : [number, string][] = [];
            try {
                const data = await server.getDDLFile("SHOPS.DAT");
                server.on("modified",reload);
                const hive = shopsFromArrayBuffer(data,true);
                hive.forEach((v,idx)=>out.push([idx,v.keeper]));
            } catch (e) {
            }        
            out.sort((a,b)=>a[1].localeCompare(b[1]))
            return out;
        })();
    }
    return await shop_list;
}

export default getGlobalShops;