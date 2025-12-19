<script setup lang="ts">
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar from '@/components/statusBar.ts'
import { findFreeShopSlot, ProductFlags, shopsFromArrayBuffer, shopsToArrayBuffer, TProduct, TShop } from '@/core/shop_structs';
import { itemsFromArrayBuffer, ItemTypeName, type ItemDef } from '@/core/items_struct';
import HIFormat from '@/core/hiformat'
import { PCX, PCXProfile } from '@/core/pcx';
import { messageBoxAlert, messageBoxConfirm } from '@/utils/messageBox';
import { getDDLFileWithImport } from '@/components/tools/missingFiles';



const shop_list = ref<TShop[]>([]);
const item_list = ref<ItemDef[]>([]);
const current_shop_index = ref<number>();
const current_shop =  ref<TShop>();
const img_list = ref<string[]>([]);

const picture_cache = new Map<string, Promise<HIFormat | PCX> >();
const pic_preview = ref<HTMLElement>();
const list_filter = ref<string>("");
const add_product_input = ref<string>("");
const add_kind_input = ref<string>("");

watch(current_shop_index,(nw)=>{
    current_shop.value = (nw!==undefined && shop_list.value && shop_list.value[nw]) || undefined
});

watch(shop_list, ()=>{
    StatusBar.set_changed(true);
}, {deep:true});

watch([current_shop,pic_preview], ()=>{

    if (current_shop.value&& pic_preview.value) {        
        const r= pic_preview.value;
        const fname = current_shop.value.picture;
        let p;
        const ishi = fname.toUpperCase().endsWith(".HI");
        if (picture_cache.has(fname)) {
            p = picture_cache.get(fname);
        } else {
            p = server.getDDLFile(fname).then(buff=>ishi?HIFormat.fromArrayBuffer(buff):PCX.fromArrayBuffer(buff))
                    .catch((e)=>{
                        r.innerHTML = "";
                        throw e;
                    });
        }
        if (p) {
            p.then(img=>{
                const c = ishi?(img as HIFormat).createCanvas():(img as PCX).createCanvas(PCXProfile.default);
                r.innerHTML = "";
                if (c.width != 264 || c.height != 180) {
                    messageBoxAlert("Picture has unsupported resolution. Required 264x180");
                }
                r.appendChild(c);
                c.style.width="264px";
                c.style.height="180px";
            },()=>{})
        }
    }
}, {deep:true})

function init() {

    function reload() {
        getDDLFileWithImport(server,"SHOPS.DAT",AssetGroup.MAPS).then(buff=>{
            if (buff) {
                shop_list.value = shopsFromArrayBuffer(buff);
            } else {
                shop_list.value = [];   
            }
            nextTick(()=>{
                StatusBar.set_changed(false);
            });
        })
        getDDLFileWithImport(server,"ITEMS.DAT", AssetGroup.MAPS).then(buff=>{
            if (buff) item_list.value = itemsFromArrayBuffer(buff);            
            else item_list.value = [];
        });
    }
    reload();

    server.getDDLFiles(AssetGroup.DIALOGS,null).then(async resp=>{
        const lst = resp.files.map(x=>x.name).filter(x=>x.toUpperCase().match(/\.PCX$|\.HI$/));
        img_list.value = lst;
        for (let i = 0; i < lst.length; ++i) {
            const name = lst[i];
            const f = await server.getDDLFile(name);
            const z =  name.toUpperCase().endsWith(".HI")?HIFormat.fromArrayBuffer(f):PCX.fromArrayBuffer(f);
            if (z.width != 264 || z.height != 180) {
                img_list.value = [];                
                delete lst[i];
                lst.forEach(x=>img_list.value.push(x));
            }
        }
    });


    StatusBar.register_save_and_revert({save: async ()=>{
        if (shop_list.value) {
            const shp:TShop[] = [];
             shop_list.value.forEach(v=>{
                const new_plist = v.product_list.filter(x=>(x.trade_flags & ProductFlags.SHP_TYPE) == 0);
                const types : TProduct[] = [];
                const add_plist : TProduct[] = []
                v.product_list.filter(x=>(x.trade_flags & ProductFlags.SHP_TYPE) != 0)
                    .forEach(t=>{
                        const type = t.item 
                        if (item_list.value) {
                            const itms = item_list.value.filter(x=>x.druh == type && x.jmeno);
                            itms.forEach((v, idx)=>{
                                const p = new TProduct();
                                p.item = idx;
                                p.cena = v.cena;
                                p.max_pocet = 10;
                                p.pocet = 0;
                                p.trade_flags = (t.trade_flags | ProductFlags.SHP_POPULATED) & ~ProductFlags.SHP_TYPE;
                                add_plist.push(p);
                            })
                        }
                        types.push(t);
                    });
                const nw = new TShop();
                Object.assign(nw, v);
                nw.list_size = new_plist.length;
                new_plist.push(...types,...add_plist);
                nw.products = new_plist.length;
                nw.product_list = new_plist;
                shp.push(nw);
            });
            const buff = shopsToArrayBuffer(shp);
            return await server.putDDLFile("SHOPS.DAT", buff, AssetGroup.MAPS);
        }
        return true;
    },revert: ()=>{        
        reload();
    }});
}
onMounted(init);

function mod_flag(where: TProduct, flg:number) {
    where.trade_flags = where.trade_flags ^ flg;
}

function delete_product(v: TProduct) {
    if (current_shop.value) {
        const idx = current_shop.value.product_list.findIndex(x=>x==v);
        if (idx != -1) {
            current_shop.value.product_list.splice(idx,1);
        }
    }
}

function add_product() {
    if (add_product_input.value && current_shop.value) {
        const s = add_product_input.value;
        add_product_input.value = "";
        const idx = item_list.value.findIndex(v=>v.jmeno.trim() == s.trim());
        if (idx != -1) {
            const prod = new TProduct();
            prod.cena = item_list.value[idx].cena;
            prod.item = idx;            
            current_shop.value.product_list.push(prod);
        }
    }
}

function add_kind() {
    if (add_kind_input.value && current_shop.value) {
        const s = add_kind_input.value;
        add_kind_input.value ="";
        const prod = new TProduct();
        prod.item = parseInt(s);            
        prod.trade_flags = ProductFlags.SHP_TYPE;
        current_shop.value.product_list.push(prod);
    }
}

function createKeeper() {
    if (shop_list.value) {
        const n:number = findFreeShopSlot(shop_list.value);
        shop_list.value[n] = new TShop();
        shop_list.value[n].shop_id = n;
        current_shop_index.value = n;
    }
}

async function deleteKeeper() {    
    if (current_shop.value && current_shop_index.value !== undefined 
                && await messageBoxConfirm("Confirm you want to delete shop: "+current_shop.value.keeper)) {
        delete shop_list.value[current_shop_index.value];
        current_shop_index.value = undefined;
    }
}

onUnmounted(StatusBar.final_save);

</script>
<template>

<x-workspace>
    <datalist id="editorShop112"><option v-for="v of img_list" :key="v" :value="v"></option></datalist>
    <datalist id="editorShopItems171"><option v-for="(v,idx) of item_list" :key="idx" :value="v.jmeno"></option></datalist>
    <div class="shop-list" >
        <input type="search" v-model="list_filter">
        <select v-model="current_shop_index" size="10">
            <option v-for="v of shop_list.filter(v=>v).filter(v=>-1 != v.keeper.toLocaleLowerCase().indexOf(list_filter.toLocaleLowerCase()))" :key="v.shop_id" :value="v.shop_id" > {{  v.keeper }}</option>
        </select>        
        <div class="buttons">
            <button @click="createKeeper">Create</button>
            <button @click="deleteKeeper">Delete</button>
        </div>
    </div>
    <div class="main-panel" v-if="current_shop !== undefined">
        <div>
            <x-section>
                <x-section-title>Basic information</x-section-title>
                <x-form>
                    <label><span>Keeper name</span><input type="text" v-model="current_shop.keeper" maxlength="15"></label>
                    <label><span>Picture</span><input type="text" v-model="current_shop.picture" maxlength="12" list="editorShop112"></label>
                    <label><span>Price spread</span><input type="number" v-model="current_shop.koef" v-watch-range min="0" max="100"></label>
                    <label><span>Max spec items [%]</span><input type="number" v-model="current_shop.spec_max" v-watch-range min="0" max="32767"></label>
                </x-form>
                <div class="pict-preview" ref="pic_preview"></div>
            </x-section>
            <x-section  class="products">
                <x-section-title>Products</x-section-title>
                <div class="lst"> 
                <table>
                    <thead>
                        <tr><th>Item</th><th>Initial count</th><th>Max count</th><th>Base price</th>
                        <th>Buy</th><th>Sell</th><th>Add</th><th>Spc</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="(v,idx) of current_shop.product_list.filter(x=>(x.trade_flags & ProductFlags.SHP_TYPE) == 0)">
                            <td>{{ item_list[v.item].jmeno }}</td>
                            <td><input type="number" v-model="v.pocet" v-watch-range min="0" max="999999"></td>                                                        
                            <td><input type="number" v-model="v.max_pocet"  v-watch-range min="0" max="999999"></td>
                            <td><input type="number" v-model="v.cena"  v-watch-range min="0" max="999999"></td>
                            <td><input type="checkbox" :checked="0!=(v.trade_flags & ProductFlags.SHP_BUY)" @click="mod_flag(v,ProductFlags.SHP_BUY)"></td>
                            <td><input type="checkbox" :checked="0!=(v.trade_flags & ProductFlags.SHP_SELL)"  @click="mod_flag(v,ProductFlags.SHP_SELL)"></td>
                            <td><input type="checkbox" :checked="0!=(v.trade_flags & ProductFlags.SHP_AUTOADD)" @click="mod_flag(v,ProductFlags.SHP_AUTOADD)"></td>
                            <td><input type="checkbox" :checked="0!=(v.trade_flags & ProductFlags.SHP_SPECIAL)"  @click="mod_flag(v,ProductFlags.SHP_SPECIAL)"></td>
                            <td><button @click="delete_product(v)">×</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="add">
                <input type="text" v-model="add_product_input" list="editorShopItems171"><button @click="add_product">Add</button>
            </div>
  
            </x-section>
            <x-section  class="types">
                <x-section-title>Accepts</x-section-title>
                <div class="lst"> 
                <table>
                    <thead>
                        <tr><th>Kind</th><th>Price adj[%]</th><th>Max count</th><th>Buy</th><th>Sell</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="(v,idx) of current_shop.product_list.filter(x=>(x.trade_flags & ProductFlags.SHP_TYPE) != 0)">
                        <td>{{ ItemTypeName[v.item] }}</td>
                        <td><input type="number" v-model="v.cena"></td>                                                        
                        <td><input type="number" v-model="v.max_pocet"  v-watch-range min="0" max="999999"></td>
                        <td><input type="checkbox" :checked="0!=(v.trade_flags & ProductFlags.SHP_BUY)" @click="mod_flag(v,ProductFlags.SHP_BUY)"></td>
                        <td><input type="checkbox" :checked="0!=(v.trade_flags & ProductFlags.SHP_SELL)"  @click="mod_flag(v,ProductFlags.SHP_SELL)"></td>
                        <td><button @click="delete_product(v)">×</button></td>                        
                        </tr>
                    </tbody>
                </table>
                </div>
                <div class="add">
                    <select v-model="add_kind_input">
                        <option value=""> -- select -- </option>
                        <option v-for="(v,idx) of ItemTypeName" :key="idx" :value="idx"> {{  v }}</option>
                        </select>
                    <button @click="add_kind">Add</button>
                </div>                
            </x-section>
            

        </div>
    </div>
</x-workspace>


</template>
<style lang="css" scoped>

.shop-list {
    position: absolute;
    left:0;
    top: 0;
    width: 15rem;
    bottom: 0;
}
.shop-list input {
    position: absolute;
    left: 0;
    right: 0;
    top:0;
    height: 2rem;
}
.shop-list select {
    position: absolute;
    left: 0;
    right: 0;
    top:2rem;
    bottom: 2rem;
}
.shop-list .buttons {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2rem;
    display: flex;    
}
.shop-list .buttons>* {
    flex-grow: 1;
}

.main-panel {
    position: absolute;
    left: 15rem;
    top: 0;
    bottom: 0;
    right: 0;    
    overflow: auto;
    
}


.main-panel > div {
    display: flex;    
    flex-wrap: wrap;
    max-height: 100%;

}
.pict-preview {
    text-align: center;
}

input[type=number] {
    width: 5rem;
    text-align: center;
}

.products {
    padding-bottom:2em;
}
.products > div.lst {
    position: relative;
    height: 100%;
    overflow: auto;
}


</style>