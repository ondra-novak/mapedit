#pragma once

#include "config.hpp"
#include "ddlman.hpp"
#include "server.hpp"
#include "wsrpc.hpp"
#include "mgifcomp.hpp"
#include "skeldal_exe.hpp"
#include "wsrpc.hpp"
#include "publisher.hpp"
#include <filesystem>
#include <shared_mutex>
#include <thread>


namespace server {

struct Request;


class WebInterface {
public:

    static constexpr auto keepalive_interval = std::chrono::seconds(5);

    WebInterface(Config cfg, std::stop_source stop);
    
    std::function<bool( BasicRequest &)> get_handler();

protected:
    std::unique_ptr<DDLManager> _game;
    std::shared_mutex _mx;
    std::filesystem::path _user_dir;
    std::filesystem::path _game_folder;
    std::string _addrport;
    std::u8string _current_ddl;
    std::stop_source _stop;
    Json _config;
    bool _check_active = false;

    WsRpc::MethodMap _methods;

    MGifComp _mgfcomp;
    std::mutex _mgfcomp_mx;

    bool webserver(Request &req);
    bool webserver_index(Request &req);
    bool webserver_assets(Request &req);
 
    bool websocket(Request &req);
 

    bool serve_file(std::string_view path, Request &req);
 
    
    bool ddl_get(Request &req);


    bool command(Request &req);
    bool control(Request &req);
    void control(std::string_view cmd);

    void basic_timer_worker(std::stop_token stp);
    void on_timer_tick();

    std::mutex _stream_mx;
    std::vector<Stream> _streams;

    void broadcast(std::string_view data);
 
    std::jthread _basic_timer;

    std::unique_ptr<SkeldalExeControl> _game_control;
 
    DDLManager getUserDDL() const;

    void load_config();
    void save_config();

    bool init_game_dir(std::filesystem::path game_dir, const Json &skeldal_ini);


    void ws_ping(const WsRpc::Request &rq);

    void ws_all_ddl_list(const WsRpc::Request &req);
    void ws_all_ddl_list_delete(const WsRpc::Request &req);
    void ws_ddl_list(const WsRpc::Request &req);
    void ws_ddl_get(const WsRpc::Request &req);
    void ws_ddl_put(const WsRpc::Request &req);
    void ws_ddl_delete(const WsRpc::Request &req);
    void ws_ddl_stats(const WsRpc::Request &req);
    void ws_ddl_compact(const WsRpc::Request &req);
    void ws_ddl_mpg_get(const WsRpc::Request &req);
    void ws_ddl_mpg_create(const WsRpc::Request &req);
    void ws_ddl_mpg_put_image(const WsRpc::Request &req);
    void ws_ddl_mpg_close(const WsRpc::Request &req);
    void ws_ddl_active(const WsRpc::Request &req);
    void ws_keep_alive(const WsRpc::Request &req);
    void ws_config_get(const WsRpc::Request &req);
    void ws_config_put(const WsRpc::Request &req);
    void ws_preview_start(const WsRpc::Request &req);
    void ws_preview_stop(const WsRpc::Request &req);
    void ws_preview_teleport(const WsRpc::Request &req);
    void ws_preview_test_dialog(const WsRpc::Request &req);
    void ws_preview_reload(const WsRpc::Request &req);
    void ws_preview_console_show(const WsRpc::Request &req);
    void ws_preview_console_exec(const WsRpc::Request &req);
    void ws_control(const WsRpc::Request &req);
    void ws_file_history(const WsRpc::Request &req);    
    void ws_file_copy(const WsRpc::Request &req);   
    void ws_publish_status(const WsRpc::Request &req);   
    void ws_publish_set_image(const WsRpc::Request &req);   
    void ws_publish_publish(const WsRpc::Request &req);   
    void ws_lang_list(const WsRpc::Request &req);
    void ws_lang_get(const WsRpc::Request &req);
    void ws_lang_put(const WsRpc::Request &req);
    void ws_lang_delete(const WsRpc::Request &req);
    void ws_lang_copyddl(const WsRpc::Request &req);

    void send_state_update(WsRpc &rpc);

    static constexpr WsRpc::MethodDef<WebInterface> methods[] = {

        {"ping", &WebInterface::ws_ping},
        {"project_list", &WebInterface::ws_all_ddl_list},
        {"project_delete", &WebInterface::ws_all_ddl_list_delete},
        {"list_files",&WebInterface::ws_ddl_list},
        {"file_get",&WebInterface::ws_ddl_get},
        {"file_put",&WebInterface::ws_ddl_put},
        {"file_history",&WebInterface::ws_file_history},
        {"file_copy", &WebInterface::ws_file_copy},
        {"file_delete",&WebInterface::ws_ddl_delete},
        {"project_stats",&WebInterface::ws_ddl_stats},
        {"project_compact",&WebInterface::ws_ddl_compact},
        {"mgf_get",&WebInterface::ws_ddl_mpg_get},
        {"mgf_create",&WebInterface::ws_ddl_mpg_create},
        {"mgf_put_image",&WebInterface::ws_ddl_mpg_put_image},
        {"mgf_close",&WebInterface::ws_ddl_mpg_close},
        {"project_set_active",&WebInterface::ws_ddl_active},
        {"config_get",&WebInterface::ws_config_get},
        {"config_put",&WebInterface::ws_config_put},
        {"preview_start",&WebInterface::ws_preview_start},
        {"preview_stop",&WebInterface::ws_preview_stop},
        {"preview_teleport",&WebInterface::ws_preview_teleport},
        {"preview_reload",&WebInterface::ws_preview_reload},
        {"preview_test_dialog",&WebInterface::ws_preview_test_dialog},
        {"preview_console_show",&WebInterface::ws_preview_console_show},
        {"preview_console_exec",&WebInterface::ws_preview_console_exec},
        {"publish.status", &WebInterface::ws_publish_status},
        {"publish.set_image", &WebInterface::ws_publish_set_image},
        {"publish.publish", &WebInterface::ws_publish_publish},
        {"lang.list", &WebInterface::ws_lang_list},
        {"lang.get", &WebInterface::ws_lang_get},
        {"lang.put", &WebInterface::ws_lang_put},
        {"lang.delete", &WebInterface::ws_lang_delete},
        {"lang.copyddl", &WebInterface::ws_lang_copyddl}
    };


    WsPublisher _publisher;
    void publish_state();
    Json create_state();

    std::optional<std::vector<char>  >file_get(std::string_view name, std::uint32_t rev);
    bool file_put(std::string_view name, std::uint32_t group, bool fail_if_exists, std::string_view data);
};


}