#include "interface.hpp"
#include "handler_map.hpp"
#include <fstream>

namespace server {

Server::Handler WebInterface::get_handler() {



constexpr Endpoint<WebInterface> endpoints[] = {
    {Method::GET, "/files/maps/{}", &WebInterface::serve_maps},
    {Method::GET, "/ddl", &WebInterface::serve_maps},
    {Method::GET, "/ddl/{}", &WebInterface::serve_maps},
    {Method::PUT, "/ddl/{}", &WebInterface::serve_maps},
    {Method::DELETE, "/ddl/{}", &WebInterface::serve_maps},
    {Method::POST, "/ddl/compact", &WebInterface::serve_maps},
    {Method::GET, "/assets/{}", &WebInterface::assets},
    {Method::GET, "/{}", &WebInterface::webserver}
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
    if (req.path_vars[0].empty()) return serve_file(_app_dir, "index.html", req);
    return serve_file(_app_dir, req.path_vars[0], req);
}

bool WebInterface::assets(Request &req)
{
        return serve_file(_asset_dir, req.path_vars[0], req);
}

bool WebInterface::serve_maps(Request &req)
{
    return serve_file(_maps, req.path_vars[0],req);
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
    return false;
}

bool WebInterface::ddl_get(Request &req)
{
    return false;
}

bool WebInterface::ddl_put(Request &req)
{
    return false;
}

bool WebInterface::ddl_delete(Request &req)
{
    return false;
}

bool WebInterface::ddl_stats(Request &req)
{
    return false;
}

bool WebInterface::ddl_compact(Request &req)
{
    return false;
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