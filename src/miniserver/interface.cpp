#include "interface.hpp"
#include "ddlman.hpp"
#include "handler_map.hpp"
#include "mgifdecomp.hpp"
#include "skeldal_exe.hpp"
#include "utils/json.hpp"
#include <chrono>
#include <cstdio>
#include <exception>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <memory>
#include <mutex>
#include "utils/json.hpp"
#include "wsrpc.hpp"
#include <condition_variable>
#include <optional>
#include <shared_mutex>
#include <string>
#include <string_view>
#include <system_error>
#include <thread>

namespace server {

WebInterface::WebInterface(Config cfg, std::stop_source stp)
    :_app_dir(cfg.app_dir)
    ,_assets_dir(cfg.asset_dir)
    ,_user_dir(cfg.user_folder)
    ,_addrport(cfg.addr_port)
    ,_stop(std::move(stp))
    ,_check_active(cfg.check_active)    
    ,_basic_timer([this](std::stop_token tkn){basic_timer_worker(std::move(tkn));})
    
//    ,_game_control(cfg.game_folder, cfg.game_ini, cfg.addr_port,[this](std::string_view cmd){this->control(cmd);})
{
    _methods.register_methods<WebInterface>(this,methods);
    load_config();
}


std::function<bool( BasicRequest &)> WebInterface::get_handler() {



constexpr Endpoint<WebInterface> endpoints[] = {
    {Method::GET, "/api/ddl/{}", &WebInterface::ddl_get},
    {Method::GET, "/assets/{}", &WebInterface::webserver_assets},
    {Method::GET, "/command", &WebInterface::command},
    {Method::GET, "/ws", &WebInterface::websocket},
    {Method::GET, "/{}", &WebInterface::webserver},
    {Method::GET, "/", &WebInterface::webserver_index}
};


      return create_basic_handler(this,endpoints);
}
constexpr std::string_view  extension_to_mime(const std::string_view & ext) {
    // List of extension/mime pairs
    constexpr std::pair<std::string_view, std::string_view> mime_types[] = {
        {".html", "text/html;charset=utf-8"},
        {".htm", "text/html;charset=utf-8"},
        {".css", "text/css;charset=utf-8"},
        {".js", "application/javascript"},
        {".json", "application/json"},
        {".png", "image/png"},
        {".jpg", "image/jpeg"},
        {".jpeg", "image/jpeg"},
        {".gif", "image/gif"},
        {".svg", "image/svg+xml"},
        {".ico", "image/x-icon"},
        {".bmp", "image/bmp"},
        {".webp", "image/webp"},
        {".txt", "text/plain;charset=utf-8"},
        {".woff", "font/woff"},
        {".woff2", "font/woff2"},
        {".ttf", "font/ttf"},
        {".eot", "application/vnd.ms-fontobject"},
        {".otf", "font/otf"}
    };

    for (const auto& [key, value] : mime_types) {
        if (ext == key) return value;            
    }
    return "application/octet-stream";
}

bool WebInterface::webserver(Request &req)
{
    return serve_file(_app_dir, req.path_vars[0], req);
}

bool WebInterface::webserver_index(Request &req)
{
    return serve_file(_app_dir, "index.html", req);
}

bool WebInterface::webserver_assets(Request &req)
{
        return serve_file(_assets_dir, req.path_vars[0], req);
}

bool WebInterface::serve_file(const std::filesystem::path &path, std::string_view name, Request &req)
{
        std::shared_lock _(_mx);    
        if (name.find_first_of("/\\") != name.npos) return false;
        auto p = path/name;
        auto ext = p.extension();
        auto mime = extension_to_mime(ext.string());
        std::error_code ec;
        auto sz = std::filesystem::file_size(p, ec);
        if (ec != std::error_code{}) return false;
        std::ifstream f(p, std::ios::in|std::ios::binary);
        if (!f) return false;
        char buff[8192];
        return req.response({200,"OK"},{{"Content-Type",mime}}, sz,[&]{
            f.read(buff,sizeof(buff));
            auto cnt =  f.gcount();
            if (cnt == 0) return std::string_view(" ");
            else return std::string_view(buff,cnt);
        });

}

std::optional<std::vector<char>  > WebInterface::file_get(std::string_view name, std::uint32_t rev) {
    std::shared_lock _(_mx);    
    auto user = getUserDDL();
    auto f = user.get(name, static_cast<std::uint32_t>(rev));
    if (!f && !rev) {
        if (_game) {
            f = _game->get(name);
            if (!f) {
                auto p = _game->get_path();
                auto rs = p.parent_path()/"maps"/name;
                std::ifstream data(rs, std::ios::in|std::ios::binary);
                if (!data) return f;
                f.emplace();
                std::copy(std::istreambuf_iterator<char>(data),std::istreambuf_iterator<char>(), std::back_inserter(*f));
            }
        } else {
            return f;
        }
    }    
    return f;

}

bool WebInterface::ddl_get(Request &req)
{

    std::size_t rev = 0;
    for (const auto &[k,v]: req.query) {
        if (k == "rev") rev = std::stoull(v);
    }
    auto name = req.path_vars[0];
    auto data = file_get(name, rev);
    if (!data) return req.response({404},{},{});
    return req.response({200},{
        {"Content-Type","application/octet-stream"}
    },std::string_view(data->data(), data->size()));
}


Json WebInterface::create_state() {
    std::size_t stream_count;
    {
        std::lock_guard _(_stream_mx);
        stream_count = _streams.size();
    }
    return Json({
        {"game_instances",stream_count},
        {"current_ddl", _current_ddl},
        {"need_configure", !_game}
    });
}
void WebInterface::send_state_update(WsRpc &rpc) {
    rpc.send_notify("state", create_state());    
}

void WebInterface::publish_state() {
    _publisher.publish("state",create_state());
}

bool WebInterface::command(Request &req)
{
    Stream s;
    if (req.response({200,"OK"},{{"Content-Type","text/event-stream"}}, s)) {
        {
            std::lock_guard _(_stream_mx);
            _streams.push_back(std::move(s));
        }
        publish_state();
        return true;
    }

    return false;
}

void  WebInterface::broadcast(std::string_view data) {
    bool b = false;
    {
        std::lock_guard _(_stream_mx);
        auto new_end = std::remove_if(_streams.begin(), _streams.end(), [&](Stream &s){
            return !s.write(data);
        });        
        if (new_end != _streams.end()) {
            b = true;
            _streams.erase(new_end, _streams.end());    
        }
    }
    if (b) {
        publish_state();
    }
    

}

DDLManager WebInterface::getUserDDL() const
{
    return DDLManager(_user_dir/_current_ddl);
}

bool WebInterface::init_game_dir(std::filesystem::path game_dir, const Json &skeldal_ini) {
    auto full_dir =game_dir/"SKELDAL.DDL";
    if (!std::filesystem::is_regular_file(full_dir))  return false;
    std::filesystem::path ini = _user_dir/"skeldal.ini";    
    {
        std::ofstream txt(ini, std::ios::out|std::ios::trunc);
        txt << "[video]\n" ;
        for (const auto &[k,v]: skeldal_ini.as_object()) {
            txt << k << "=";
            if (v.is_bool()) {
                txt << (v.as<bool>()?"on":"off");
            } else {
                txt << v.as<std::string>();
            }
            txt << "\n";            
        }        
    }
    _game = std::make_unique<DDLManager>(full_dir);
    _game_control = std::make_unique<SkeldalExeControl>(game_dir,ini,_addrport,[this](auto s){this->control(s);});
    return true;
}

void WebInterface::load_config()
{
    try {
        std::ifstream cfgdata(_user_dir/".config", std::ios::in);
        if (!cfgdata) {
            _config = Json::Object();
        } else {
            std::string content((std::istreambuf_iterator<char>(cfgdata)), std::istreambuf_iterator<char>());
            _config = Json::from_string(content);
        }
        _current_ddl = _config["project"].as<std::u8string>();
        auto game_dir = _config["game_dir"].as<std::u8string>();
        const auto &skeldal_ini = _config["skeldal_ini"];
        
        init_game_dir(game_dir, skeldal_ini);

    } catch (...) {
        _config = Json::Object();
    }


}

void WebInterface::save_config()
{
    auto cfgpath = _user_dir/".config";
    std::ofstream cfgdata(_user_dir/".config", std::ios::out|std::ios::trunc);
    if (!cfgdata) {
        throw std::runtime_error("Failed to open config file:" + cfgpath.string());
    }
    std::string jsonstr = _config.to_string();
    cfgdata.write(jsonstr.data(), jsonstr.size());
}

bool WebInterface::control(Request &req)
{
    auto b = req.body;
    control(b);
    return req.response({202,"Accepted"},{},"");
}

void WebInterface::control(std::string_view cmd) {
    std::string buff;
    while (!cmd.empty()) {
        auto ln = utils::trim(utils::split_at(cmd,"\n"));
        buff = std::format("data: {}\r\n", ln);
        broadcast(buff);
    }
    broadcast("\r\n");

}

void WebInterface::basic_timer_worker(std::stop_token stp)
{
    std::mutex mx;
    std::unique_lock lk(mx);
    std::condition_variable cv;
    std::stop_callback stpcb(stp, [&]{
        cv.notify_all();        
    });
    while (!stp.stop_requested()) {
        cv.wait_for(lk, keepalive_interval);
        on_timer_tick();
    }
}
void WebInterface::on_timer_tick()
{
    broadcast(":ping");
    broadcast("\r\n\r\n");    
    if (_last_seen) {
        _last_seen = false;
    } else if (_check_active) {
        _stop.request_stop();       
    }
}



bool WebInterface::websocket(Request &req) {
    auto stream = WsRpc::connect_ws_as_server(req);
    if (!stream) return req.response({400},{},"websocket interface");
    WsRpc ws(std::move(*stream), _methods);
    _publisher.register_client(ws);
    ws.send_notify("state", create_state());
    try {
        ws.run_service(_stop.get_token());    
    } catch (std::exception &e) {
        ws.send_notify("unhandled", e.what());
    }
    if (_publisher.unregister_client(ws)) {
        if (_check_active) {
            std::this_thread::sleep_for(std::chrono::seconds(5));
            if (_publisher.empty()) {
                _stop.request_stop();
            }            
        }
    }
    return true;    
}

void WebInterface::ws_ping(const WsRpc::Request &rq) {
    rq.send_response(rq.params,rq.attachments);
}

void WebInterface::ws_all_ddl_list(const WsRpc::Request &req) {
    constexpr utils::HeaderKey extension = ".DDL";

    auto to_timestamp=[](std::filesystem::file_time_type ftime){
        auto sctp = std::chrono::time_point_cast<std::chrono::system_clock::duration>(
            ftime - std::filesystem::file_time_type::clock::now() + std::chrono::system_clock::now()
        );
        return std::chrono::system_clock::to_time_t(sctp);
    };

    std::vector<Json> result;
    auto iter = std::filesystem::directory_iterator(_user_dir);
    auto iter_end = std::filesystem::directory_iterator();
    while (iter != iter_end) {
        const auto &entry = *iter;
        if (entry.is_regular_file() && extension == utils::HeaderKey(entry.path().extension().string())) {
            result.push_back(Json{
                {"name", entry.path().filename().string()},
                {"size", entry.file_size()},
                {"last_write", to_timestamp(entry.last_write_time())}
            });
        }
        ++iter;
    }
    req.send_response(result);
}
void WebInterface::ws_all_ddl_list_delete(const WsRpc::Request &req) {
    auto name = req.params[0].as<std::u8string>();
    auto full_name = _user_dir / name;
    std::error_code ec;
    std::filesystem::remove(full_name, ec);    
    req.send_response(true);
}
void WebInterface::ws_ddl_list(const WsRpc::Request &req) {
    std::shared_lock _(_mx);    
    std::optional<uint32_t> sel_group;
    std::optional<bool> user_assets;
    
    const auto &jgroup = req.params[0]["group"];
    const auto &jsrc = req.params[0]["source"];
    if (jgroup.is_number()) {
        sel_group = jgroup.as<uint32_t>();
    } 
    if (jsrc.is_string()) {
        auto s = jsrc.as_text();
        if (s == "user") user_assets = true;
        if (s == "orig") user_assets = false;
    }
    
    auto user = getUserDDL();

    std::vector<DDLManager::Item> game_files;
    if (_game)  game_files = _game->list();
    std::vector<DDLManager::Item> user_files = user.list();
    std::vector<DDLManager::Item> out_files;

    auto cmp =[](const auto &a, const auto &b) {
        return a.name.compare(b.name) < 0;
    };

    std::sort(game_files.begin(), game_files.end(), cmp);
    std::sort(user_files.begin(), user_files.end(), cmp);

    std::set_union(game_files.begin(), game_files.end(),
                   user_files.begin(), user_files.end(),
                   std::back_inserter(out_files),cmp);

    out_files.erase(std::remove_if(out_files.begin(), out_files.end(), [&](const DDLManager::Item &val)->bool{
            if (sel_group && val.group != *sel_group) return true;
            if (user_assets) {
                auto iter = std::lower_bound(user_files.begin(), user_files.end(), val, cmp);
                bool ovr = iter != user_files.end() && iter->name == val.name;            
                if (ovr != *user_assets) return true;
            }
            return false;
    }), out_files.end());

    std::vector<Json> files;
    files.reserve(out_files.size());
    std::transform(out_files.begin(), out_files.end(), std::back_inserter(files), [&](const DDLManager::Item &val){
            auto iter = std::lower_bound(user_files.begin(), user_files.end(), val, cmp);
            bool ovr = iter != user_files.end() && iter->name == val.name;            
            if (ovr && iter->group) return Json({val.name, iter->group, ovr});
            else return Json({val.name, val.group, ovr});
    });

    req.send_response({
        {"files", Json(std::move(files))}
    });

}
void WebInterface::ws_ddl_get(const WsRpc::Request &req) {
    auto name = req.params[0].as<std::string>();
    auto rev = req.params[1].as<std::uint32_t>();
    auto data = file_get(name, rev);
    if (!data) {
        req.send_error(404, "Not found");
    } else {
        auto files = std::span<const WsRpc::Attachment>({&*data,1});
        req.send_response(nullptr, files);
    }
}

bool WebInterface::file_put(std::string_view name, std::uint32_t group, bool fail_if_exists, std::string_view data) {
    {
        std::lock_guard _(_mx);
        auto user = getUserDDL();
        if (fail_if_exists && user.exists(name)) return false;
        user.put(name, data, group);    
    }
    _publisher.publish("modified_file", name);
    return true;
}

void WebInterface::ws_ddl_put(const WsRpc::Request &req) {

    auto name = req.params[0].as<std::string>();
    auto group =  req.params[1].as<std::uint32_t>();
    auto fexists = req.params[2].as<bool>();

    if (req.attachments.size() != 1) {
        req.send_error(400,"Missing attachment");
        return;
    }

    const auto &data = req.attachments[0];
    if (data.size() > 0x7FFFFFFF) {
         req.send_error(413,"Content Too Large");    
    } else {
        bool p = file_put(name, group, fexists, {data.data(), data.size()});
        if (!p) {
            req.send_error(409,"Exists");    
        } else {
            req.send_response(true);         
        }
    }

}
void WebInterface::ws_ddl_delete(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    auto user = getUserDDL();
    auto name = req.params[0].as<std::string>();
    user.erase(name);
    req.send_response(true);         
}
void WebInterface::ws_ddl_stats(const WsRpc::Request &req) {
    std::shared_lock _(_mx);    
    auto user = getUserDDL();
    auto stats = user.get_stats();

    return req.send_response({
            {"directory_space",stats.directory_space},
            {"entries_reserved",stats.entries_reserved},
            {"entries_used",stats.entries_used},
            {"reserved_space",stats.reserved_space},
            {"total_space",stats.total_space},
            {"used_space",stats.used_space}
    });    

}
void WebInterface::ws_ddl_compact(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    auto user = getUserDDL();
    user.compact();    
    return req.send_response(true);

}
void WebInterface::ws_ddl_mpg_get(const WsRpc::Request &req) {
    std::shared_lock _(_mx);       
    auto user = getUserDDL();
    auto name = req.params[0].as<std::string>();
    auto f = user.get(name);
    if (!f) {
        f = _game?_game->get(name):std::nullopt;
        if (!f) {
            req.send_error(404, "Not found");
            return;
        }
    }    
    auto stream = decompress_mgf(f->data());
    if (stream.empty()) {
            req.send_error(409, "Can't decompress");
    }else {
        std::vector<char> stream_cpy(stream.begin(), stream.end());
        auto files = std::span(&stream_cpy,1);
        req.send_response(nullptr, files);
    }

}
void WebInterface::ws_ddl_mpg_create(const WsRpc::Request &req) {
    std::lock_guard _(_mgfcomp_mx);    
    auto fname = req.params["filename"];
    auto frames = req.params["frames"];
    auto transp = req.params["transparent"];    
    auto group = req.params["group"];
    std::string_view err = {};
    if (!fname.is_string()) err = "Missing or invalid 'filename'";
    else if (!frames.is_number() || frames.as<int>() < 1) err = "Missing or invalid 'frames'";
    else if (!group.is_number()  || group.as<int>() < 0) err = "Missing or invalid 'group'";
    else if (!transp.is_bool() ) err = "Missing or invalid 'transparent'";
    if (!err.empty()) {
        req.send_error(400,err);
        return;
    }

    auto uuid = _mgfcomp.create_mgif(fname.as<std::string>(), group.as<int>(), frames.as<unsigned int>(), transp.as<bool>());

    req.send_response(uuid);
}

void WebInterface::ws_ddl_mpg_put_image(const WsRpc::Request &req) {
    std::lock_guard _(_mgfcomp_mx);
    std::string uuid = req.params[0].as<std::string>();
    if (req.attachments.size() != 1) {
        req.send_error(400, "Missing attachment");
        return ;
    }
    const auto &data = req.attachments[0];
    auto st = _mgfcomp.put_image_pcx(uuid, {data.data(),data.size()});
    char need = static_cast<char>(st.need);
    Json status = {
        {"need", std::string_view(&need,1)},
        {"processed", st.processed},
        {"error", st.reason}
    };
    req.send_response(status);

}
void WebInterface::ws_ddl_mpg_close(const WsRpc::Request &req) {
    std::lock_guard _(_mgfcomp_mx);
    std::string uuid = req.params[0].as<std::string>();
    auto r = _mgfcomp.close(uuid);
    auto user = getUserDDL();
    if (!r.creator ) {
        req.send_error(410,"Gone");
        return;
    } else {
        if (r.creator->getNeed() != MGIFCreator::nothing) {
            req.send_error(204,"Not available");
            return;
        }
        std::lock_guard __(_mx);
        const auto &data = r.creator->get_data();
        user.put(r.name, {reinterpret_cast<const char *>(data.data()),data.size()},r.group);
        req.send_response(r.name);
    }
    
}
void WebInterface::ws_ddl_active(const WsRpc::Request &req) {
    auto name = req.params[0].as<std::u8string>();
    for (char c: name) {
        if (!((c >= '0' && c <= '9')
            || (c >= 'A' && c <='Z')
            || (c >= 'a' && c <='z')
            || (c == '_' || c == '-' || c =='.'))) {
                req.send_error(400, "DDL Archive name validation failed (unsupported characters)");
                return;
            }                           
    }
    _current_ddl = name;
    _config.set("project", _current_ddl);
     save_config();        
     publish_state();
     req.send_response(true);
}
void WebInterface::ws_config_get(const WsRpc::Request &req) {
    std::shared_lock _(_mx);
    req.send_response(_config);
}
void WebInterface::ws_config_put(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    const auto &game_dir = req.params[0]["game_dir"];
    const auto &skeldal_ini = req.params[0]["skeldal_ini"];
    if (!game_dir.is_null() && init_game_dir(game_dir.as<std::u8string>(), skeldal_ini)) {
        _config.set("game_dir",game_dir);
        _config.set("skeldal_ini",skeldal_ini);
        save_config();
        req.send_response(true);
        publish_state();
    } else {
        req.send_response(false);
    }

}
void WebInterface::ws_preview_start(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    if (!_game_control) req.send_error(404, "Not configured");
    _game_control->start(_user_dir/_current_ddl);
   req.send_response(true);   

}
void WebInterface::ws_preview_stop(const WsRpc::Request &req) {
    if (!_game_control) {
        req.send_error(404, "Not configured");
    } else if (_game_control->stop()) {
        req.send_response(true);
    } else {
        req.send_error(504,"Timeout");
    }

}
void WebInterface::ws_preview_teleport(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    if (!_game_control) {
        req.send_error(404, "Not configured");
        return;
    }
    std::string map = req.params[0]["map"].as<std::string>();
    unsigned int sect = req.params[0]["sector"].as<unsigned int>();
    unsigned int side = req.params[0]["side"].as<unsigned int>();

    std::filesystem::path ddlpath(_user_dir/_current_ddl);
    if (ddlpath != _game_control->get_current_ddlpath()) {
        return req.send_error(409,"Conflict");
    }

    _game_control->teleport_to(map,sect,side);
    req.send_response(true);

}
void WebInterface::ws_preview_reload(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    if (!_game_control) {
        req.send_error(404, "Not configured");
        return;
    }
    _game_control->reload_map();
    req.send_response(true);

}
void WebInterface::ws_preview_console_show(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    if (!_game_control) {
        req.send_error(404, "Not configured");
        return;
    }
    bool sw = req.params[0].as<bool>();
    _game_control->console_show(sw);
    req.send_response(true);

}
void WebInterface::ws_preview_console_exec(const WsRpc::Request &req) {
    std::lock_guard _(_mx);
    if (!_game_control) {
        req.send_error(404, "Not configured");
        return;
    }
    _game_control->console_exec(req.params[0].as<std::string>());
    req.send_response(true);
}

void WebInterface::ws_file_history(const WsRpc::Request &req) {
    std::shared_lock _(_mx);
    auto ddl = getUserDDL();
    auto hist = ddl.get_history(req.params[0].as_text());
    Json::Array res;
    for (const auto &[rev, tp]: hist) {
        res.push_back({rev, std::chrono::system_clock::to_time_t(tp)});
    }
    req.send_response(res);   
}

void WebInterface::ws_file_copy(const WsRpc::Request &req) {
    auto source_name = req.params[0].as_text();
    auto target_name = req.params[1].as_text();
    auto target_group = req.params[2].as_unsigned_int();
    auto source_rev = req.params[3].as_unsigned_int();
    

    auto data = file_get(source_name, source_rev);
    if (!data) {
        req.send_error(404, "Not found");
    } else {
        bool b = file_put(target_name, target_group, false, {data->data(), data->size()});
        req.send_response(b);
    }
}

}


