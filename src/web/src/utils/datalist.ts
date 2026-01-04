export type DataListItem = {
    value: string;
    label?: string;
}

export type DataListPopulateFn =  ()=>DataListItem[] | Promise<DataListItem[]>;

type ElementReference = {
    el: HTMLDataListElement
}

export type DataListHandle = {
    id: string;
    fn: DataListPopulateFn,
    el: ElementReference
    update: (fn?: DataListPopulateFn)=>void;
}

function create_handle(id: string, el: ElementReference, fn: DataListPopulateFn) : DataListHandle{
    return {
        id: id,
        el: el,
        fn: fn,
        update: function (fn?: DataListPopulateFn) {
            if (fn) this.fn = fn;
            Promise.resolve(this.fn()).then(lines=>{
                const el = this.el.el;
                el.innerHTML = "";
                for (const v of lines) {
                    const opt = document.createElement("OPTION") as HTMLOptionElement;
                    opt.value = v.value;
                    if (v.label) opt.textContent = v.label;
                    el.appendChild(opt);
                }
            })
        }
    }
}


class DataList {

    #namedlist: Record<string, DataListHandle> = {};

    #activelists: Record<string, HTMLDataListElement> = {};
    #cleanup = false;
    #id_counter = 1;
    #registry = new FinalizationRegistry((el:HTMLDataListElement)=>{
        const p = el.parentElement;
        if (p) p.removeChild(el);
    });

    create_list(fn?: DataListPopulateFn, name?: string): DataListHandle {

        if (name) {
            const h = this.#namedlist[name];
            if (h) return h;           
        }

        const id = `_adhoc_datalist_${this.#id_counter}`;
        ++this.#id_counter;
        const act = document.createElement("DATALIST") as HTMLDataListElement;
        act.setAttribute("id", id);
        document.body.insertBefore(act, document.body.firstChild!);
        const ref : ElementReference = {el: act};
        if (!fn) fn = ()=>[];
        const ret = create_handle(id, ref, ()=>[]);
        if (fn) ret.update(fn);

        this.#registry.register(ref, ref.el);

        if (name) {
            this.#namedlist[name] = ret;
        }

        this.#housekeeping();

        return ret;
    }

    #housekeeping() {
        if (!this.#cleanup) {
            this.#cleanup = true;
            setTimeout(()=>{
                this.#cleanup = false;
                const s = new Set<string>();
                Array.from(document.body.getElementsByTagName("INPUT"))
                    .filter(el=>el.hasAttribute("list"))
                    .forEach(el=>s.add(el.getAttribute("list") || ""));
                for (const k in this.#activelists) {
                    if (!s.has(k)) {
                        delete this.#namedlist[k];
                    }
                }
            },1000);
        }
    }

}

const data_list_handler = new DataList;

export function create_datalist(fn?: DataListPopulateFn, name?: string) : DataListHandle{
    return data_list_handler.create_list(fn,name);
}

