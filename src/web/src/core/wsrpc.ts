
export type WsRpcResult = {
    data: any,
    attachments: ArrayBuffer[]
}

type Pending = {
    suc:(x:WsRpcResult)=>void;
    fail:(x:any)=>void;
};


type ReceivedMessage = {
    success:boolean
    id: string;
    data: any;
    attachments: ArrayBuffer[];
};

class WsRpcClient {
    
    #idcnt: number = 1;
    #ws: WebSocket|null = null;;
    #tosend : (string| ArrayBuffer)[] = [];
    #response_map = new Map<number, Pending>();
    url:string;
    #cur_message: ReceivedMessage|null = null;
    #awaiting_attachment_count: number = 0;    
    #disconnected = true;
    
    #channels: Map<string, ((x:WsRpcResult)=>void)[]> = new Map();
    #connection: ((x:boolean)=>void)[] = [];

    constructor() {
        this.url = location.href.split('#')[0].replace(/^http/,"ws") + "ws";
        this.connect();
    }

    call(method:string, params: any[], attachments: ArrayBuffer[]) {
        const r =  new Promise<WsRpcResult>((suc:(x:WsRpcResult)=>void, fail:(x:any)=>void)=>{
            const id = ++this.#idcnt;
            const msg = `${attachments.length}\n${id}\n${method}\n${JSON.stringify(params)}`;
            this.#tosend.push(msg, ... attachments);
            this.flush();
            this.#response_map.set(id, {suc,fail});
        });

        if (process.env.NODE_ENV === "development") {
            r.then(
                (result) => console.log(`[RPC] ${method} success:`, params, result),
                (error) => console.error(`[RPC] ${method} error :`, params, error)
            );
        }
        return r;
        
    }

    flush() {
        const ws = this.#ws;
        if (ws && ws.readyState == WebSocket.OPEN) {
            this.#tosend.forEach(msg=>ws.send(msg));
            this.#tosend = [];
        }
    }

    connect() {
        this.#ws = new WebSocket(this.url);
        this.#ws.binaryType = "arraybuffer";
        this.#ws.onopen = (ev)=>{
            if (this.#disconnected) {
                this.#disconnected = false;
                this.#connection.forEach(x=>x(true));
            }
            this.flush();
        };
        this.#ws.onmessage = (ev)=>{
            this.process_message(ev.data);
        };
        this.#ws.onclose = (ev)=>{
            this.reject_all();
            setTimeout(()=>this.connect(), 5000);
            if (!this.#disconnected) {
                this.#disconnected = true;
                this.#connection.forEach(x=>x(false));
            }
        };
    }

    reject_all() {
        this.#response_map.forEach((v,k)=>{
            v.fail(new Error("Connection closed"));
        });
        this.#response_map.clear();
    }

    process_message(msg: string|ArrayBuffer) {
        if (typeof msg === "string") {

            if (this.#awaiting_attachment_count > 0) {
                console.error("Invalid state, awaiting attachments but got string", msg);
                this.#ws?.close();
                return;
            }

            const parts = msg.split("\n");
            if (parts.length < 4) {
                console.error("Invalid message received", msg);
                return;
            }
            const attachment_count = parseInt(parts[0]);
            const id = parts[1];
            const success = parts[2] === "1";
            const data = JSON.parse(parts.slice(3).join("\n"));
            this.#cur_message = {
                success: success,
                id: id,
                data: data,
                attachments: []
            };
            this.#awaiting_attachment_count = attachment_count;

            if (this.#awaiting_attachment_count === 0) {
                this.finish_current_message();
            }

        } else {
            // ArrayBuffer
            if (this.#cur_message === null) {
                console.error("Invalid state, got attachment but no current message");
                this.#ws?.close();
                return;
            }
            this.#cur_message.attachments.push(msg);
            this.#awaiting_attachment_count--;
            if (this.#awaiting_attachment_count === 0) {
                this.finish_current_message();
            }   
        }
    }

    finish_current_message() {
        if (this.#cur_message === null) {
            console.error("Invalid state, finish_current_message called but no current message");
            this.#ws?.close();
            return;
        }
        const msg = this.#cur_message;
        this.#cur_message = null;

        if (msg.id.startsWith('#')) {
            const channel = msg.id.substring(1);
            const value: WsRpcResult = Object.freeze({data:msg.data,attachments:msg.attachments});

            if (process.env.NODE_ENV === "development") {
                console.log("[RPC] ", msg.id, value);             
            }        

            const cb_list = this.#channels.get(channel)!;
            if (cb_list) {
                cb_list.forEach(cb=>queueMicrotask(()=>cb(value)));
            }
            return;

        }
        const id = parseInt(msg.id);


        const pending = this.#response_map.get(id);
        if (!pending) {

            console.error("No pending request for message id", msg.id);
            return;
        }
        this.#response_map.delete(id);

        if (msg.success) {
            pending.suc({
                data: msg.data,
                attachments: msg.attachments
            });
        } else {
            pending.fail(msg.data);
        }
    }

    on(channel: string, cb:(x:WsRpcResult)=>void) {
        const ch = this.#channels.get(channel);
        if (!ch) {
            this.#channels.set(channel, [cb]);
        } else {
            ch.push(cb);
        }
    }

    off(channel: string, cb:(x:WsRpcResult)=>void) {
        const ch = this.#channels.get(channel);
        if (ch) {
            const idx = ch.findIndex(x=>x === cb);
            if (idx >= 0) {
                ch.splice(idx,1);
                if (ch.length === 0) {
                    this.#channels.delete(channel);
                }      
            }
        }
    }   

    on_connection_state_change(cb:(x:boolean)=>void) {
        this.#connection.push(cb);
    }
    off_connection_state_change(cb:(x:boolean)=>void) {
        const idx = this.#connection.findIndex(x=>x === cb);
        if (idx >= 0) {
            this.#connection.splice(idx,1);            
        }
    }


}

export default WsRpcClient;

