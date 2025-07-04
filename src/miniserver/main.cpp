#include "ini_file.hpp"
#include "server.hpp"
#include "handler_map.hpp"
#include "config.hpp"
#include "interface.hpp"
#include "utils/profile_path.hpp"



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
    std::basic_string<char8_t> game_folder = ini.get("paths", "game_folder", u8"");
    std::basic_string<char8_t> user_folder = ini.get("paths", "adventure_folder", u8"");

    server::Config cfg;
    auto parent = root_config.parent_path();
    cfg.app_dir = parent/"web";
    cfg.asset_dir = parent/"web"/"assets";
    cfg.game_folder = game_folder.empty()?parent.parent_path():parent/game_folder;
    cfg.user_folder = user_folder.empty()
            ?getUserDocumentsPath() / u8"Skeldal_Adventure":std::filesystem::current_path()/user_folder;
    cfg.check_active = ini.get_bool("server","exit_on_close",true);

    std::filesystem::create_directories(cfg.user_folder);

    server::Server srv(addrport);
    std::stop_source stp;
    std::stop_token tkn = stp.get_token();

    server::WebInterface ifc(cfg, stp);
    std::string url = "http://" + srv.get_listen_addr();

    std::cout <<  "Server running at: " << url << std::endl;

    if (open_browser) {
        open_url(url);
    }

    srv.serve(ifc.get_handler(), tkn);
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

