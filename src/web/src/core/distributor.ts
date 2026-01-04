export class Distributor<T> {

    private prom: Promise<T>|null = null;;
    private trigg: ((a:T)=>void)|null = null;

    constructor() {
        this.prom = new Promise(ok=>{
            this.trigg = ok;
        });
    }

    async listen() : Promise<T> {
        return await this.prom!;
    };

    async trigger(data:T): Promise<void> {
        let trig = this.trigg;
        this.prom = new Promise(ok=>{
            this.trigg = ok;
        })
        trig!(data);
        //queue as microtask to let listeners to run
        return new Promise(ok=>queueMicrotask(ok));
    }
};

export default Distributor;