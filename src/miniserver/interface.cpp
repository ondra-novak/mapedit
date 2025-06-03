#include "interface.hpp"
#include "handler_map.hpp"
#include <fstream>

namespace server {

Server::Handler WebInterface::get_handler() {



constexpr Endpoint<WebInterface> endpoints[] = {
    {Method::GET, "/files/maps", &WebInterface::serve_map_list},
    {Method::GET, "/files/maps/{}", &WebInterface::serve_maps},
    {Method::GET, "/ddl", &WebInterface::ddl_list},
    {Method::GET, "/ddl/{}", &WebInterface::ddl_get},
    {Method::PUT, "/ddl/{}", &WebInterface::ddl_put},
    {Method::DELETE, "/ddl/{}", &WebInterface::ddl_delete},
    {Method::POST, "/ddl/compact", &WebInterface::ddl_compact},
    {Method::GET, "/assets/{}", &WebInterface::assets},
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

bool WebInterface::assets(Request &req)
{
        return serve_file(_asset_dir, req.path_vars[0], req);
}

bool WebInterface::serve_maps(Request &req)
{
    return serve_file(_maps, req.path_vars[0],req);
}

bool WebInterface::serve_map_list(Request &req)
{
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
    std::vector<std::string> game_files = _game.list();
    std::vector<std::string> user_files = _user.list();
    std::vector<std::string> out_files;

    std::sort(game_files.begin(), game_files.end());
    std::sort(user_files.begin(), user_files.end());

    std::set_union(game_files.begin(), game_files.end(),
                   user_files.begin(), user_files.end(),
                   std::back_inserter(out_files));

    auto stats = _user.get_stats();
    return req.response({200},{},json::value({
        {"files", json::value(out_files.begin(), out_files.end(), [&](const std::string &val){
            auto iter = std::lower_bound(user_files.begin(), user_files.end(), val);
            bool ovr = iter != user_files.end() && *iter == val;
            return json::value({val, ovr});
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
    if (req.path_vars[0].empty()) return false;
    if (req.body.size() > 0x7FFFFFFF) {
        return req.response({413,"Content Too Large"},{},"");
    }
    _user.put(req.path_vars[0], req.body);
    return req.response({202,"Accepted"},{},"");
}

bool WebInterface::ddl_delete(Request &req)
{
    if (req.path_vars[0].empty()) return false;
    _user.erase(req.path_vars[0]);
    return req.response({202,"Accepted"},{},"");
}


bool WebInterface::ddl_compact(Request &req)
{
    _user.compact();
    return req.response({202,"Accepted"},{},"");
}

WebInterface::WebInterface(Config cfg)
    :_game(cfg.game_ddl)
    ,_user(cfg.user_ddl)
    ,_maps(cfg.maps)
    ,_app_dir(cfg.app_dir)
    ,_asset_dir(cfg.asset_dir)
{

}


}