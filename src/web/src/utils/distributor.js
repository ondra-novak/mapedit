class Distributor {

    #prom;
    #trigger;

    constructor() {
        this.#prom = new Promise(ok=>{
            this.#trigger = ok;
        });
    }

    async listen() {
        return await this.#prom;
    };

    async trigger(data) {
        let trig = this.#trigger;
        this.#prom = new Promise(ok=>{
            this.#trigger = ok;
        })
        trig(data);
        //queue as microtask to let listeners to run
        return new Promise(ok=>queueMicrotask(ok));
    }
};

export default Distributor;