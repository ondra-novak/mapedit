#include "interface.hpp"
#include "handler_map.hpp"
#include "mgifdecomp.hpp"
#include <fstream>
#include <mutex>
#include <json/serializer.h>
#include <json/parser.h>

namespace server {

Server::Handler WebInterface::get_handler() {



constexpr Endpoint<WebInterface> endpoints[] = {
    {Method::GET, "/api/maps", &WebInterface::serve_map_list},
    {Method::GET, "/api/maps/{}", &WebInterface::serve_maps},
    {Method::GET, "/api/ddl", &WebInterface::ddl_list},
    {Method::GET, "/api/ddl/mgf/{}", &WebInterface::ddl_mpg_get},
    {Method::POST, "/api/ddl/mgf", &WebInterface::ddl_mpg_create},
    {Method::GET, "/api/ddl/{}", &WebInterface::ddl_get},
    {Method::PUT, "/api/ddl/{}", &WebInterface::ddl_put},
    {Method::DELETE, "/api/ddl/{}", &WebInterface::ddl_delete},
    {Method::POST, "/api/ddl/compact", &WebInterface::ddl_compact},
    {Method::GET, "/assets/{}", &WebInterface::webserver_assets},
    {Method::PUT, "/api/mgf_session/{}", &WebInterface::ddl_mpg_session_put},
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

bool WebInterface::serve_maps(Request &req)
{
    return serve_file(_maps, req.path_vars[0],req);
}

bool WebInterface::serve_map_list(Request &req)
{
    std::shared_lock _(_mx);    
    std::vector<std::string> files;
    for (auto iter = std::filesystem::directory_iterator(_maps);iter != std::filesystem::directory_iterator();++iter) {
        if (iter->is_regular_file()) {
            files.push_back(iter->path().filename().string());
        }
    }
    return req.response({200},{},json::value{{"files",json::value(files.begin(), files.end())}});
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
        return req.response({200,"OK"},{{"Content-Type",mime}}, {sz,[&]{
            f.read(buff,sizeof(buff));
            auto cnt =  f.gcount();
            if (cnt == 0) return std::string_view(" ");
            else return std::string_view(buff,cnt);
        }});

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


    std::vector<DDLManager::Item> game_files = _game.list();
    std::vector<DDLManager::Item> user_files = _user.list();
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

    auto stats = _user.get_stats();
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
    auto f = _user.get(req.path_vars[0]);
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
    if (req.path_vars[0].empty()) return false;
    if (req.body.size() > 0x7FFFFFFF) {
        return req.response({413,"Content Too Large"},{},"");
    }
    uint32_t group =0;
    auto iter = std::find_if(req.query.begin(), req.query.end(), [](const auto &kv){return kv.first == "group";});
    if (iter != req.query.end()) group = static_cast<uint32_t>(std::stoul(iter->second));
    _user.put(req.path_vars[0], req.body,group);
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::ddl_delete(Request &req)
{
    std::lock_guard _(_mx);
    if (req.path_vars[0].empty()) return false;
    _user.erase(req.path_vars[0]);
    return req.response({202,"Accepted"},{},"");
}


bool WebInterface::ddl_compact(Request &req)
{   
    std::lock_guard _(_mx);
    _user.compact();
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::ddl_mpg_get(Request &req)
{
    std::shared_lock _(_mx);       
    auto f = _user.get(req.path_vars[0]);
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

WebInterface::WebInterface(Config cfg)
    :_game(cfg.game_ddl)
    ,_user(cfg.user_ddl)
    ,_maps(cfg.maps)
    ,_app_dir(cfg.app_dir)
    ,_assets_dir(cfg.asset_dir)
{

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
        if (!r.creator ) {
            return req.response({410}, {}, "");        
        }
        if (r.creator->getNeed() != MGIFCreator::nothing) {
            return req.response({204}, {}, "");
        }
         std::lock_guard _(_mx);
         const auto &data = r.creator->get_data();
         _user.put(r.name, {reinterpret_cast<const char *>(data.data()),data.size()},r.group);
        return req.response({201},{{"Location","/api/ddl/"+r.name}},r.name);

    }

 
    return false;
}




}