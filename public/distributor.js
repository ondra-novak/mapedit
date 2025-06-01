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

    trigger(data) {
        let trig = this.#trigger;
        this.#prom = new Promise(ok=>{
            this.#trigger = ok;
        })
        trig(data);
    }

};

export default Distributor;