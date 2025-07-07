
export function shallowClone<T>(obj: T | T[]):T|T[] {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.slice();
    const cloned = Object.create(Object.getPrototypeOf(obj));
    return Object.assign(cloned, obj);
}

export function deepFreeze<T>(obj : T) {
    if (obj !== null && typeof obj === "object" && !Object.isFrozen(obj))  {
        for (const v in obj) {
            deepFreeze(obj[v]);
        }
        Object.freeze(obj);
    }
}

export class Document<T> {

    undoredo_stack: T[] = [];
    current: number = 0;


    constructor(doc: T) {
        this.reset(doc);
    }

    reset(doc: T) {
        deepFreeze(doc);
        this.undoredo_stack = [doc];
        this.current = 0;
    }

    get_current():T {
        return this.undoredo_stack[this.current];
    }

    can_undo() {
        return this.current > 0;
    }

    can_redo() {
        return this.current < this.undoredo_stack.length-1;
    }

    do_undo() :T {
        --this.current;
        return this.get_current();
    }
    do_redo() :T {
        ++this.current;
        return this.get_current();
    }
    begin_edit() : T {
        const r = shallowClone(this.get_current());
        ++this.current;
        this.undoredo_stack.splice(this.current, this.undoredo_stack.length - this.current, r as T);
        return r as T;
    }
}