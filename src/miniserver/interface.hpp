#pragma once

#include "config.hpp"
#include "ddlman.hpp"
#include "server.hpp"
#include "mgifcomp.hpp"
#include <shared_mutex>


namespace server {

struct Request;


class WebInterface {
public:

    WebInterface(Config cfg);
    
    Server::Handler get_handler();

protected:
    DDLManager _game;
    DDLManager _user;
    std::shared_mutex _mx;
    std::filesystem::path _maps;
    std::filesystem::path _app_dir;
    std::filesystem::path _assets_dir;

    MGifComp _mgfcomp;
    std::mutex _mgfcomp_mx;

    bool webserver(Request &req);
    bool webserver_index(Request &req);
    bool webserver_assets(Request &req);
    bool serve_maps(Request &req);
    bool serve_map_list(Request &req);
    

    bool serve_file(const std::filesystem::path &path, std::string_view name, Request &req);
 
    
    bool ddl_list(Request &req);
    bool ddl_get(Request &req);
    bool ddl_put(Request &req);
    bool ddl_delete(Request &req);
    bool ddl_stats(Request &req);
    bool ddl_compact(Request &req);
    bool ddl_mpg_get(Request &req);
    bool ddl_mpg_create(Request &req);
    bool ddl_mpg_session_put(Request &req);

};


}