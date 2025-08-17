#include "interface.hpp"
#include "handler_map.hpp"
#include "mgifdecomp.hpp"
#include <fstream>
#include <mutex>
#include <json/serializer.h>
#include <json/parser.h>
#include <condition_variable>

namespace server {

WebInterface::WebInterface(Config cfg, std::stop_source stp)
    :_game(cfg.game_folder/u8"SKELDAL.DDL")
    ,_app_dir(cfg.app_dir)
    ,_assets_dir(cfg.asset_dir)
    ,_user_dir(cfg.user_folder)
    ,_stop(std::move(stp))
    ,_check_active(cfg.check_active)    
    ,_basic_timer([this](std::stop_token tkn){basic_timer_worker(std::move(tkn));})
    ,_game_control(cfg.game_folder, cfg.game_ini, cfg.addr_port,[this](std::string_view cmd){this->control(cmd);})
{
    load_config();
}



std::function<bool( BasicRequest &)> WebInterface::get_handler() {



constexpr Endpoint<WebInterface> endpoints[] = {
    {Method::GET, "/api/ddl/mgf/{}", &WebInterface::ddl_mpg_get},
    {Method::POST, "/api/ddl/mgf", &WebInterface::ddl_mpg_create},
    {Method::GET, "/api/ddl/{}", &WebInterface::ddl_get},
    {Method::PUT, "/api/ddl/{}", &WebInterface::ddl_put},
    {Method::DELETE, "/api/ddl/{}", &WebInterface::ddl_delete},
    {Method::POST, "/api/ddl/compact", &WebInterface::ddl_compact},
    {Method::GET, "/api/ddl", &WebInterface::ddl_list},
    {Method::GET, "/api/list", &WebInterface::all_ddl_list},
    {Method::PUT, "/api/active", &WebInterface::ddl_active},
    {Method::GET, "/api/active", &WebInterface::ddl_active},
    {Method::POST, "/api/control", &WebInterface::control},
    {Method::GET, "/api/keepalive", &WebInterface::keep_alive},
    {Method::GET, "/assets/{}", &WebInterface::webserver_assets},
    {Method::PUT, "/api/mgf_session/{}", &WebInterface::ddl_mpg_session_put},
    {Method::POST, "/api/game/start", &WebInterface::preview_start},
    {Method::POST, "/api/game/stop", &WebInterface::preview_stop},
    {Method::POST, "/api/game/teleport", &WebInterface::preview_teleport},
    {Method::POST, "/api/game/reload", &WebInterface::preview_reload},
    {Method::POST, "/api/game/console_show", &WebInterface::preview_console_show},
    {Method::POST, "/api/game/console_exec", &WebInterface::preview_console_exec},
    {Method::GET, "/command", &WebInterface::command},
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

bool WebInterface::all_ddl_list(Request &req)
{
    constexpr utils::HeaderKey extension = ".DDL";

    auto to_timestamp=[](std::filesystem::file_time_type ftime){
        auto sctp = std::chrono::time_point_cast<std::chrono::system_clock::duration>(
            ftime - std::filesystem::file_time_type::clock::now() + std::chrono::system_clock::now()
        );
        return std::chrono::system_clock::to_time_t(sctp);
    };

    std::vector<json::value> result;
    auto iter = std::filesystem::directory_iterator(_user_dir);
    auto iter_end = std::filesystem::directory_iterator();
    while (iter != iter_end) {
        const auto &entry = *iter;
        if (entry.is_regular_file() && extension == utils::HeaderKey(entry.path().extension().string())) {
            result.push_back({
                {"name", entry.path().filename().string()},
                {"size", entry.file_size()},
                {"last_write", to_timestamp(entry.last_write_time())}
            });
        }
        ++iter;
    }
    return req.response({200,{}},{},json::value(result.begin(), result.end()));
}
    

bool WebInterface::ddl_list(Request &req)
{
    std::shared_lock _(_mx);    
    std::optional<uint32_t> sel_group;
    std::optional<bool> user_assets;

    for (const auto &[k,v]: req.query) {
        if (k == "group") sel_group = std::stoul(v);
        else if (k == "type") {
            if (v == "user") user_assets = true;
            if (v == "orig") user_assets = false;
        };
    }

    auto user = getUserDDL();

    std::vector<DDLManager::Item> game_files = _game.list();
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

    auto stats = user.get_stats();
    return req.response({200},{},json::value({
        {"files", json::value(out_files.begin(), out_files.end(), [&](const DDLManager::Item &val){
            auto iter = std::lower_bound(user_files.begin(), user_files.end(), val, cmp);
            bool ovr = iter != user_files.end() && iter->name == val.name;            
            if (ovr && iter->group) return json::value({val.name, iter->group, ovr});
            else return json::value({val.name, val.group, ovr});
        })},
        {"stats",{
            {"directory_space",stats.directory_space},
            {"entries_reserved",stats.entries_reserved},
            {"entries_used",stats.entries_used},
            {"reserved_space",stats.reserved_space},
            {"total_space",stats.total_space},
            {"used_space",stats.used_space}
        }}
    }));
}

bool WebInterface::ddl_get(Request &req)
{
    std::shared_lock _(_mx);    
    auto user = getUserDDL();
    auto f = user.get(req.path_vars[0]);
    if (!f) {
        f = _game.get(req.path_vars[0]);
        if (!f) return false;
    }    
    return req.response({200},{
        {"Content-Type","application/octet-stream"}
    },std::string_view(f->data(), f->size()));
}

bool WebInterface::ddl_put(Request &req)
{
    std::lock_guard _(_mx);
    auto user = getUserDDL();
    if (req.path_vars[0].empty()) return false;
    if (req.body.size() > 0x7FFFFFFF) {
        return req.response({413,"Content Too Large"},{},"");
    }
    uint32_t group =0;
    bool fail_if_exists = false;
    auto iter = std::find_if(req.query.begin(), req.query.end(), [](const auto &kv){return kv.first == "group";});
    if (iter != req.query.end()) group = static_cast<uint32_t>(std::stoul(iter->second));
    iter = std::find_if(req.query.begin(), req.query.end(), [](const auto &kv){return kv.first == "fexists";});
    if (iter != req.query.end()) fail_if_exists = static_cast<uint32_t>(std::stoul(iter->second)) != 0;
    const std::string &name = req.path_vars[0];
    if (fail_if_exists && user.exists(name)) {
        return req.response({409,"Conflict"},{},"");
    } else {
        user.put(req.path_vars[0], req.body,group);        
        return req.response({202,"Accepted"},{},"");
    }
}

bool WebInterface::ddl_delete(Request &req)
{
    std::lock_guard _(_mx);
    auto user = getUserDDL();
    if (req.path_vars[0].empty()) return false;
    user.erase(req.path_vars[0]);
    return req.response({202,"Accepted"},{},"");
}


bool WebInterface::ddl_compact(Request &req)
{   
    std::lock_guard _(_mx);
    auto user = getUserDDL();
    user.compact();    
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::ddl_mpg_get(Request &req)
{
    std::shared_lock _(_mx);       
    auto user = getUserDDL();
    auto f = user.get(req.path_vars[0]);
    if (!f) {
        f = _game.get(req.path_vars[0]);
        if (!f) return false;
    }    
    auto stream = decompress_mgf(f->data());
    if (stream.empty()) {
        return false;
    }
    return req.response({200},{
        {"Content-Type","application/octet-stream"}
            },std::string_view(reinterpret_cast<const char *>(stream.data()), stream.size()));
   
}


bool WebInterface::ddl_mpg_create(Request &req)
{
    std::lock_guard _(_mgfcomp_mx);
    json::value jrq;
    try {
        jrq = json::value::from_json(req.body);
    } catch (std::exception &e) {
        return req.response({400,"Bad Request"},{{"Content-Type","text/plain"}}, e.what());        
    }
    auto fname = jrq["filename"];
    auto frames = jrq["frames"];
    auto transp = jrq["transparent"];    
    auto group = jrq["group"];
    std::string_view err = {};
    if (fname.type() != json::type::string) err = "Missing or invalid 'filename'";
    else if (frames.type() != json::type::number || frames.as<int>() < 1) err = "Missing or invalid 'frames'";
    else if (group.type() != json::type::number || group.as<int>() < 0) err = "Missing or invalid 'group'";
    else if (transp.type() != json::type::boolean) err = "Missing or invalid 'transparent'";
    if (!err.empty()) {
        return req.response({400,"Bad Request"},{{"Content-Type","text/plain"}}, err);        
    }

    auto uuid = _mgfcomp.create_mgif(fname.as<std::string>(), group.as<int>(), frames.as<unsigned int>(), transp.as<bool>());

    return req.response({201, "Created"},{{"Location","/api/mgf_session/"+uuid}},uuid);
}

bool WebInterface::ddl_mpg_session_put(Request &req)
{
    std::lock_guard _(_mgfcomp_mx);
    std::string_view action;
    std::string uuid = req.path_vars[0];
    for (const auto &[k,v]: req.query) if (k == "a") action = v;
    if (action.empty()) {
        return req.response({400,"Bad Request"},{{"Content-Type","text/plain"}}, "Action 'a' is not defined");
    }
    if (action == "image") {        
        auto st = _mgfcomp.put_image_pcx(uuid, req.body);
        char need = static_cast<char>(st.need);
        json::value status = {
            {"need", std::string_view(&need,1)},
            {"processed", st.processed},
            {"error", st.reason}
        };
        return req.response({202}, {{"Content-Type","application/json"}}, status.to_json());        
    }
    if (action == "close") {
        auto r = _mgfcomp.close(uuid);
        auto user = getUserDDL();
        if (!r.creator ) {
            return req.response({410}, {}, "");        
        }
        if (r.creator->getNeed() != MGIFCreator::nothing) {
            return req.response({204}, {}, "");
        }
         std::lock_guard __(_mx);
         const auto &data = r.creator->get_data();
         user.put(r.name, {reinterpret_cast<const char *>(data.data()),data.size()},r.group);
        return req.response({201},{{"Location","/api/ddl/"+r.name}},r.name);

    }

 
    return false;
}

bool WebInterface::ddl_active(Request &req)
{
    if (req.method == Method::PUT) {
        std::u8string_view name(reinterpret_cast<const char8_t *>(req.body.data()), req.body.size());
        for (char c: name) {
            if (!((c >= '0' && c <= '9')
                || (c >= 'A' && c <='Z')
                || (c >= 'a' && c <='z')
                || (c == '_' || c == '-' || c =='.'))) throw std::runtime_error("DDL Archive name validation failed (unsupported characters)");
                        
        }
        _current_ddl = name;
        _config.set("project", _current_ddl);
        save_config();        
        return req.response({202},{},"");
    } else {
        return req.response({200},{{"Content-Type", "text/plain;charset=utf-8"}}, 
            std::string_view(reinterpret_cast<const char *>(_current_ddl.data()), _current_ddl.size()));
    }
}

bool WebInterface::keep_alive(Request &req)
{
    std::size_t stream_count;
    {
        std::lock_guard _(_stream_mx);
        stream_count = _streams.size();
    }
    if (!req.response({200,{}},{},json::value({
        {"keepalive_interval",std::chrono::duration_cast<std::chrono::milliseconds>(keepalive_interval).count()*9/10},
        {"game_instances",stream_count},
        {"exit_on_close", _check_active},
        {"current_ddl", _current_ddl}
    }))) return false;
    _last_seen = true;
    return true;
}

bool WebInterface::preview_start(Request &req)
{
    std::lock_guard _(_mx);
    _game_control.start(_user_dir/_current_ddl);
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::preview_stop(Request &req)
{
    if (_game_control.stop()) {
        return req.response({202,"Accepted"},{},"");
    } else {
        return req.response({504,"Timeout"},{},"");
    }
}

bool WebInterface::preview_teleport(Request &req)
{
    std::lock_guard _(_mx);
    json::value jr = json::value::from_json(req.body);
    std::string map = jr["map"].as<std::string>();
    unsigned int sect = jr["sector"].as<unsigned int>();
    unsigned int side = jr["side"].as<unsigned int>();

    std::filesystem::path ddlpath(_user_dir/_current_ddl);
    if (ddlpath != _game_control.get_current_ddlpath()) {
        return req.response({409,"Conflict"},{},"");
    }

    _game_control.teleport_to(map,sect,side);
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::preview_reload(Request &req)
{
    std::lock_guard _(_mx);
    _game_control.reload_map();
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::preview_console_show(Request &req)
{
    std::lock_guard _(_mx);
    json::value jr = json::value::from_json(req.body);
    bool sw = jr.as<bool>();
    _game_control.console_show(sw);
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::preview_console_exec(Request &req)
{
    std::lock_guard _(_mx);
    _game_control.console_exec(req.body);
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::command(Request &req)
{
    Stream s;
    if (req.response({200,"OK"},{{"Content-Type","text/event-stream"}}, s)) {
        std::lock_guard _(_stream_mx);
        _streams.push_back(std::move(s));
        return true;
    }

    return false;
}

void  WebInterface::broadcast(std::string_view data) {
    std::lock_guard _(_stream_mx);
    auto new_end = std::remove_if(_streams.begin(), _streams.end(), [&](Stream &s){
        return !s(data);
    });
    _streams.erase(new_end, _streams.end());    
}

DDLManager WebInterface::getUserDDL() const
{
    /*
    for (char c: name) {
        if (!((c >= '0' && c <= '9')
              || (c >= 'A' && c <='Z')
              || (c >= 'a' && c <='z')
              || (c == '_' || c == '-' || c =='.'))) throw std::runtime_error("DDL Archive name validation failed (unsupported characters)");
    }
              */
    return DDLManager(_user_dir/_current_ddl);
}

void WebInterface::load_config()
{
    try {
        std::ifstream cfgdata(_user_dir/".config", std::ios::in);
        if (!cfgdata) {
            _config = json::type::null;
        } else {
            std::string content((std::istreambuf_iterator<char>(cfgdata)), std::istreambuf_iterator<char>());
            _config = json::value::from_json(content);
        }
        _current_ddl = _config["project"].as<std::u8string>();
    } catch (...) {
        _config = json::type::null;
    }


}

void WebInterface::save_config()
{
    auto cfgpath = _user_dir/".config";
    std::ofstream cfgdata(_user_dir/".config", std::ios::out|std::ios::trunc);
    if (!cfgdata) {
        throw std::runtime_error("Failed to open config file:" + cfgpath.string());
    }
    std::string jsonstr = _config.to_json();
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
    } else if (_check_active)
        _stop.request_stop();       
    }
}
