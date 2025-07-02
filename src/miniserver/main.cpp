#include "ini_file.hpp"
#include "server.hpp"
#include "handler_map.hpp"
#include "config.hpp"
#include "interface.hpp"



std::filesystem::path find_config(const char *argv0) {
    namespace fs = std::filesystem;
    fs::path exe_path = fs::canonical(argv0);
    fs::path dir = exe_path.parent_path();

    while (true) {
        fs::path conf_path = dir / "mapedit.conf";
        fs::path conf_local_path = dir / "mapedit.local.conf";
        if (fs::exists(conf_local_path)) {
            return conf_local_path;
        }
        if (fs::exists(conf_path)) {
            return conf_path;
        }
        if (dir == dir.root_path()) {
            break;
        }
        dir = dir.parent_path();
    }
    throw std::runtime_error("mapedit.conf not found in any parent directory.");
}

IniFile load_config(std::filesystem::path cfg_path) {
    IniFile ini;
    ini.load(cfg_path);
    return ini;
}

void open_url(std::string url) {
    #if defined(_WIN32)
        std::string command = "start " + url;
        system(command.c_str());
    #elif defined(__APPLE__)
        std::string command = "open " + url;
        system(command.c_str());
    #else
        std::string command = "xdg-open " + url + " >/dev/null 2>&1 &";
        system(command.c_str());
    #endif
}

int entry_point(std::filesystem::path root_config) {

    IniFile ini = load_config(root_config);
    std::string addrport = ini.get("server","listen","localhost:0");
    bool  open_browser = ini.get_bool("server","open_browser", true);
    std::string ddl = ini.get("paths", "game_assets", "./SKELDAL.DDL");

    server::Config cfg;
    auto parent = root_config.parent_path();
    cfg.app_dir = parent/"web";
    cfg.asset_dir = parent/"web"/"assets";
    cfg.maps = parent/"files"/"maps";
    cfg.game_ddl = parent/ddl;
    cfg.user_ddl = parent/"files"/"assets.ddl";


    server::Server srv(addrport);

    server::WebInterface ifc(cfg);
    std::string url = "http://" + srv.get_listen_addr();

    std::cout <<  "Server running at: " << url << std::endl;

    if (open_browser) {
        open_url(url);
    }

    srv.listen(ifc.get_handler());
    return 0;
}

int main(int argc, char ** argv) {

    try {
        if (argc < 1) throw std::runtime_error("Invalid arguments");
        auto cfg = find_config(argv[0]);
        entry_point(cfg);
    } catch (const std::exception &e) {
        std::cerr<<"ERROR: " << e.what()  << std::endl;
    }


    server::Server srv("localhost:0");    

}

