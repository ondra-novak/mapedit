#pragma once

#include "server.hpp"
#include <stdexcept>
#include <unordered_map>
#include <string>
#include <string_view>
#include <functional>

namespace server {


    using VariableList = std::vector<std::pair<std::string, std::string> >;
    using PathVariableList = std::vector<std::string>;

    std::string urldecode(std::string_view text);

    bool match_path(std::string_view source_path, std::string_view pattern, PathVariableList &path_vars, VariableList &query_vars);


    enum class Method {
        unknown = 0, 
        GET = 1, 
        PUT = 2, 
        POST = 4, 
        DELETE = 8, 
        TRACE = 16, 
        OPTIONS = 32, 
        HEAD = 64,
        CONNECT = 128,
        PATCH = 256
    };


    struct Request : BasicRequest{
        Method method;
        PathVariableList path_vars;
        VariableList query;
    };

    using Handler = std::function<bool(Request &req)>;

    constexpr Method operator|(Method a, Method b) {
        return static_cast<Method>(static_cast<std::underlying_type_t<Method> >(a) | static_cast<std::underlying_type_t<Method> >(b));
    }
    template<Method value>
    constexpr bool contains(Method val) {
        return (static_cast<std::underlying_type_t<Method> >(val) & static_cast<std::underlying_type_t<Method> >(value)) != 0;
    }

    constexpr bool contains(Method val, Method what) {
        return (static_cast<std::underlying_type_t<Method> >(val) & static_cast<std::underlying_type_t<Method> >(what)) != 0;
    }

    template<typename Interface>
    struct Endpoint {
        using Type = Interface;        
        Method methods;
        std::string_view path_pattern;
        bool (Interface::*handler)(Request &);
    };

    constexpr std::pair<std::string_view, Method> method_map[] = {
        {"GET", Method::GET},
        {"PUT", Method::PUT},
        {"POST", Method::POST},
        {"DELETE", Method::DELETE},
        {"TRACE", Method::TRACE},
        {"OPTIONS", Method::OPTIONS},
        {"HEAD", Method::HEAD},
        {"CONNECT", Method::CONNECT},
        {"PATCH", Method::PATCH}
    };

    template<typename Interface, unsigned int N>
    auto create_basic_handler(Interface *ptr, const Endpoint<Interface> (&list)[N]) {
        return [list,ptr](BasicRequest &breq) {
            auto fmethod = std::find_if(std::begin(method_map),std::end(method_map),[&](const auto &x){return breq.method == utils::HeaderKey(x.first);});
            Request req{std::move(breq),{},{},{}};
            if (fmethod == std::end(method_map)) req.method = Method::unknown; else req.method = fmethod->second;
            try {
                for (const auto &ep: list) if (contains(ep.methods, req.method)) {
                    if (match_path(breq.path, ep.path_pattern, req.path_vars, req.query) 
                        && (ptr->*ep.handler)(req)) return true;                    
                    
                }

                for (const auto &ep: list) {
                    if (match_path("/error_404", ep.path_pattern, req.path_vars, req.query)
                        && (ptr->*ep.handler)(req)) return true;                    
                    
                }

                return req.response({404,{}},{{"Content-Type","text/plain"}},"Resource not found");
            } catch (const std::exception &e) {
                req.body = e.what();
                for (const auto &ep: list) {
                    try {
                        if (match_path("/error_500", ep.path_pattern, req.path_vars, req.query)
                            && (ptr->*ep.handler)(req)) return true;                    
                    } catch (...) { 
                        //empty
                    }
                }                
                return req.response({500,{}},{{"Content-Type","text/plain"}},"Internal error (uncaught exception)");
            }
        };
    }
    


}