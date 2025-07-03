#pragma once

#include "config.hpp"
#include "ddlman.hpp"
#include "server.hpp"
#include "mgifcomp.hpp"
#include <shared_mutex>
#include <thread>


namespace server {

struct Request;


class WebInterface {
public:

    static constexpr auto keepalive_interval = std::chrono::seconds(5);

    WebInterface(Config cfg);
    
    Server::Handler get_handler();

protected:
    DDLManager _game;
    std::shared_mutex _mx;
    std::filesystem::path _maps;
    std::filesystem::path _app_dir;
    std::filesystem::path _assets_dir;
    std::filesystem::path _user_dir;
    bool _check_active = false;

    MGifComp _mgfcomp;
    std::mutex _mgfcomp_mx;

    bool webserver(Request &req);
    bool webserver_index(Request &req);
    bool webserver_assets(Request &req);
    

    bool serve_file(const std::filesystem::path &path, std::string_view name, Request &req);
 
    
    bool all_ddl_list(Request &req);
    bool ddl_list(Request &req);
    bool ddl_get(Request &req);
    bool ddl_put(Request &req);
    bool ddl_delete(Request &req);
    bool ddl_stats(Request &req);
    bool ddl_compact(Request &req);
    bool ddl_mpg_get(Request &req);
    bool ddl_mpg_create(Request &req);
    bool ddl_mpg_session_put(Request &req);
    bool keep_alive(Request &req);

    bool command(Request &req);
    bool control(Request &req);

    void basic_timer_worker(std::stop_token stp);
    void on_timer_tick();

    std::mutex _stream_mx;
    std::vector<Stream> _streams;

    void broadcast(std::string_view data);
 
    std::jthread _basic_timer;
 
    DDLManager getUserDDL(const std::string &name) const;

};


}