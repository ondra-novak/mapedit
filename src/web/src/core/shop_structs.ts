import { BinaryIterator, BinaryWriter } from "./binary"

const TProductSchema = {
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

const TShopSchema = {
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

export function shopsFromArrayBuffer(buff: ArrayBuffer): TShop[]  {
    const result :TShop[] = [];
    const rd  = new BinaryIterator(buff);
    const count = rd.parse_type("uint32");
    for (let i = 0; i < count; ++i) {
        const shp = Object.assign(new TShop(), rd.parse(TShopSchema));
        const p = [];
        for (let j = 0; j < shp.products; ++j) {
            p.push(Object.assign(new TProduct(), rd.parse(TProductSchema)));
        }
        shp.product_list = p.filter(x=>(x.trade_flags & ProductFlags.SHP_POPULATED) == 0);
        result.push(shp);
    }
    const result2 =  result.reduce((a,b)=>{a[b.shop_id] = b;return a;},[] as TShop[]);
    return result2;
}

export function shopsToArrayBuffer(shops: TShop[]) {
    const wr = new BinaryWriter();
    wr.write_type("uint32", shops.length);
    shops.forEach(x=>{
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

export function findFreeShopSlot(shops: TShop[]) {
    for (let i = 1; i < shops.length; i++) {
        if (shops[i] === undefined) {
            return i;
        }
    }
    return shops.length;
}