const GlobalState : Record<string, any> = {}


function globalState<T>(name: string, init: T | (() => T)): T {
    const st = GlobalState[name];
    if (st !== undefined) {
        return st as T;
    } else {
        const value = typeof init === 'function' ? (init as () => T)() : init;
        GlobalState[name] = value;
        return value;
    }
}

export default globalState;