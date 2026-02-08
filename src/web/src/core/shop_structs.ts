import { BinaryIterator, BinaryWriter, type Schema } from "./binary"
import Hive from "@/utils/hive"

const TProductSchema  : Schema = {
  "item":"int16",  
  "cena":"int32",  
  "trade_flags":"int16",
  "pocet":"int32",      
  "max_pocet":"int32",
}

export class TProduct {
    item: number = 0;
    cena: number = 0;
    trade_flags: number = 0;
    pocet:number = 0;
    max_pocet:number  = 0;
};

const TShopSchema : Schema = {
  keeper:"char[16]", 
  picture:"char[13]",
  koef:"int32",
  products:"int32",  
  shop_id:"int32",
  list_size:"int32",
  spec_max:"int16",
  dummy_ptr:"int32", //unused pointer - we need to extract it
};

export class TShop {
    keeper:string = "";
    picture:string = "";
    koef:number = 0;
    products:number = 0;
    shop_id:number = 0;
    list_size:number = 0;
    spec_max:number = 0;
    dummy_ptr:number = 0;
    product_list: TProduct [] = []
};

export class ShopHive extends Hive<TShop> {};

export function shopsFromArrayBuffer(buff: ArrayBuffer): ShopHive  {
    const result :TShop[] = [];
    const rd  = new BinaryIterator(buff);
    const count = rd.parse("uint32");
    for (let i = 0; i < count; ++i) {
        const shp = Object.assign(new TShop(), rd.parse(TShopSchema));
        const p = [];
        for (let j = 0; j < shp.products; ++j) {
            p.push(Object.assign(new TProduct(), rd.parse(TProductSchema)));
        }
        shp.product_list = p.filter(x=>(x.trade_flags & ProductFlags.SHP_POPULATED) == 0);
        result.push(shp);
    }
    const result2 = new ShopHive;
    result.forEach(x=>result2.set(x.shop_id, x));
    return result2;
}

export function shopsToArrayBuffer(shops: ShopHive) {
    const wr = new BinaryWriter();
    let count = 0;
    shops.forEach(()=>count++);
    wr.write("uint32", count);
    shops.forEach((x,idx)=>{
        x.shop_id = idx;
        wr.write(TShopSchema, x);
        x.product_list.forEach(y=>{
            wr.write(TProductSchema, y);
        });
    });
    return wr.getBuffer();
}


export const ProductFlags = {
    SHP_SELL: 0x1,      //item can be sold in this shop (shop accepts)
    SHP_BUY: 0x2,       //item can be bought in this shop
    SHP_AUTOADD: 0x4,   //item is added over time
    SHP_SPECIAL: 0x8,   //special item which appears sometimes
    SHP_POPULATED: 0x40, //populated items 
    SHP_TYPE: 0x80,      //not item, but information about population
};

