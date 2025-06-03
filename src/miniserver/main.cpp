#include "ini_file.hpp"
#include "server.hpp"
#include "handler_map.hpp"
#include "config.hpp"
#include "interface.hpp"


server::Config cfg {
    ":8088",
    "/home/ondra/vscode/mapedit/public",
    "/home/ondra/vscode/mapedit/public/assets",
    "/home/ondra/skeldal_game/SKELDAL.DDL",
    "/home/ondra/vscode/mapedit/files/user.DDL",
    "/home/ondra/vscode/mapedit/files/maps"
};



int main(int argc, char ** argv) {


    server::Server srv(cfg.addr_port);

    server::WebInterface ifc(cfg);

    srv.listen(ifc.get_handler());

}