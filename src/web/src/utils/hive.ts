
class Hive<T> {
  private data: (T | null)[] = [];
  private first_free : number = Number.MAX_SAFE_INTEGER;

  add(item: T): number {
    const l = this.data.length;
    for (let idx = this.first_free; idx < l; ++idx) {
        if (this.data[idx] === null) {
            this.data[idx] = item;
            this.first_free = idx+1;
            return idx;
        }
    }
    this.data.push(item);
    return l
  }

  remove(index: number): void {
    if (index >= 0 && index < this.data.length) {
        this.data[index] = null;
        this.first_free = Math.min(this.first_free, index);
        this.optimize();
    }
  }

  optimize() {
    let l = this.data.length;
    while (l) {
        --l;
        if (this.data[l] !== null) return;
        this.data.pop();
    }
  }

  is_valid(index: number) : boolean {
    return index < this.data.length && this.data[index] !== null;
  }

  get(index: number): T {
    return this.data[index]!;
  }

  forEach(callback: (item: T, index: number) => void):void  {
    this.data.forEach((x,idx)=>{
        if (x !== null) callback(x, idx);
    })
   }

  get_raw() {return this.data;}

  findIndex(callback:(item: T, index:number) => boolean) : number {
    return this.data.findIndex((x,idx)=>{
        return  x !== null && callback(x, idx);
    })    
  }

  filter(callback:(item: T, index:number)=>boolean) : T[] {
    return this.data.filter((x,idx)=>{
        return x !== null && callback(x, idx);
    }) as T[];
  }
  map<U>(callback:(item: T, index:number)=>U) : U[] {
    const out: U[] = [];
    this.forEach((x,idx)=>out.push(callback(x,idx)))
    return out;
  }
  size()  {return this.data.length;}

  set(index: number, item: T) {
    while (index > this.data.length) {
        this.first_free = Math.min(this.first_free, this.data.length);
        this.data.push(null);
    }
    if (index == this.data.length) {
        this.data.push(item);
    } else {
        this.data[index] = item;
    }
  }
  clear() {
    this.data = [];
    this.first_free = Number.MAX_SAFE_INTEGER;
  }
}

export default Hive;