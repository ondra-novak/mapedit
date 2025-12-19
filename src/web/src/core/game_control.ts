import StatusBar, { type TeleporToFlags } from "@/components/statusBar";
import { KeepAliveStatus, server } from "./api";

function start() {
    server.game_client_start();
}

function stop() {
    server.game_client_stop();
}
function restart() {
    server.game_client_reload();

}

function teleport_to(map_name: string, sector: number, side: number, flags: TeleporToFlags) {
    server.game_client_teleport(map_name, sector, side);

    const console_cmds = ["ghost-form","no-hassle","iron-skin","levitation"];
    const sw = flags.ghost_form?"on":"off";
    const cmd = console_cmds.map(n=> n + " " + sw).join("~");
    server.game_client_console_exec(cmd);        
}

function update_ka(ks: KeepAliveStatus) {
    StatusBar.update_client_status(ks.game_instances>0);
    StatusBar.update_connect_status(ks.connected);    
}

function init_game_control() {

    StatusBar.register_game_client_cntr({
        start,
        restart,
        teleport_to,
        stop
    })
    server.on_keep_alive(update_ka);


}

export default init_game_control;