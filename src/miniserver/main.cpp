#include "ini_file.hpp"
#include "server.hpp"
#include "handler_map.hpp"
#include "config.hpp"
#include "interface.hpp"
#include "utils/profile_path.hpp"
#include "utils/getoptxx.h"
#include <filesystem>
#include <format>
#include <cstdio>



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

void show_help() {
    std::puts("mapedit_server [-p port][-b][-x][-w path][-u path][-h]\n\n"
    "-p port     specify port (default: random port)\n"
    "-b          do not open browser\n"
    "-x          do not exit if no browser ping\n"
    "-u path     specify user profile path (default: platform user profile)\n"
    );    
}

int main(int argc, char ** argv) {
    getopt_t opts;
    int c = -1;
    unsigned int port = 0;    
    bool no_browser = false;
    bool no_exit = false;
    std::filesystem::path user_dir = getUserDocumentsPath()/"Skeldal_Mapedit";
    while ((c = opts(argc, argv, "p:w:u:bxh")) != -1) {
        switch (c) {
            case 'p': port = static_cast<unsigned int>(std::strtoul(opts.optarg,nullptr,10));
                      break;
            case 'b': no_browser = true;
                      break;
            case 'x': no_exit = true;
                      break;
            case 'u': user_dir = std::filesystem::current_path() / opts.optarg;
                      break;
            case 'h': show_help(); return 0;
            default: std::fprintf(stderr, "Unknown switch -%c", c);return -1;
        }
    }   

    std::string addrport = std::format("127.0.0.1:{}", port);
    server::Server srv(addrport);
    std::string url = "http://" + srv.get_listen_addr();

    std::cout << url << std::endl;

    if (!no_browser) {
        open_url(url);
    }

    std::filesystem::create_directories(user_dir);

    server::Config cfg;
    cfg.addr_port = srv.get_listen_addr();
    cfg.check_active = !no_exit;
    cfg.user_folder = user_dir;

    std::stop_source stp;
    std::stop_token tkn = stp.get_token();

    server::WebInterface ifc(cfg, stp);
    srv.serve(ifc.get_handler(), tkn);
    return 0;

}
