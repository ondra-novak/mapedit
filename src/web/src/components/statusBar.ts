

export interface TeleporToFlags {
    ghost_form: boolean
}

export interface IGameClientControl {
    start:()=>void;
    stop:() =>void;
    reload:()=>void;
    teleport_to:(map_name: string, sector: number, side: number, flags: TeleporToFlags)=>void;
    configure:()=>void;
};

export interface SaveRevertControl {
    on_save:(cb:()=>any)=>void;
    on_revert:(cb:()=>any)=>void;
    set_changed:(changed: boolean)=>void;
    get_changed:()=>boolean;
    do_save:()=>Promise<any>;
    do_revert:()=>Promise<any>;
    unmount:()=>void;    
}

export interface IStatusBar {
    register_save_control:()=>SaveRevertControl;
    set_project_switch: (name: string, on_click: ()=>void)=>void;
    set_map_switch: (name: string, on_click: ()=>void)=>void;  
    register_game_client_cntr: (ifc: IGameClientControl)=>void;
    set_current_sector:(sector: number, side: number, map_save_cb: ()=>Promise<boolean>)=> void;
    unset_current_sector:()=>void;
    update_connect_status:(status:boolean)=>void;
    update_client_status:(status:boolean)=>void;        
    stop_game:()=>void;
    invoke_teleport:()=>void;
};

function create_promise() {
    let init = (x:IStatusBar)=>{};
    const promise = new Promise<IStatusBar>(ok=>init = ok);
    return {promise, init};
}

const conn = create_promise();

class StatusBar {

    ///called by StatusBar component to register itself
    /**
     * @param component  interface of the component
     */
    static attach_component(component: IStatusBar) {
        conn.init(component);
    }

    ///Registrer interface for save or revert operation
    /**
     * @param ifc New interface
     * There can be only one registered interface. Additional registration replaces previous one.
     * If the previous one is marked as changed, it also calls save() on previous 
     * Newly registered interface is marked as not changed
     */
    static register_save_control() {
        return conn.promise.then(st=>st.register_save_control());
    }
    ///Sets name of project and also registers callback on click on the switch button
    static set_project_switch(name:string, on_click:()=>void) {
        return conn.promise.then(st=>st.set_project_switch(name, on_click));
    }
    ///Sets name of project and also registers callback on click on the switch button
    static set_map_switch(name:string, on_click:()=>void) {
        return conn.promise.then(st=>st.set_map_switch(name, on_click));
    }
    ///Registers game client controller
    static register_game_client_cntr (ifc: IGameClientControl){
        return conn.promise.then(st=>st.register_game_client_cntr(ifc));
    }
    ///Sets current sector for game client
    /**
     * when current sector is changed for preview in game client
     * @param sector new sector
     * @param side new side
     * @param map_save_cb callback which is called when user clicks on teleport - this should invoke save
     * operation. The callback returns promise with boolean, true - teleport in game client, false - cancel operation
     */
    static set_current_sector(sector: number, side: number, map_save_cb: ()=>Promise<boolean>) {
        return conn.promise.then(st=>st.set_current_sector(sector,side,map_save_cb));
    }
    static unset_current_sector() {
        return conn.promise.then(st=>st.unset_current_sector());
    }
    static update_connect_status(status:boolean) {
        return conn.promise.then(st=>st.update_connect_status(status));
    }
    static update_client_status(status:boolean) {
        return conn.promise.then(st=>st.update_client_status(status));
    }
    static stop_game() {
        return conn.promise.then(st=>st.stop_game());
    }
    static invoke_teleport() {
        return conn.promise.then(st=>st.invoke_teleport());
    }

};

export default StatusBar;