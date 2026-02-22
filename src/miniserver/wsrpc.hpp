#pragma once

#include "server.hpp"
#include "handler_map.hpp"
#include "utils/websocket.h"
#include "utils/json.hpp"

#include <span>
#include <sstream>
#include <unordered_map>
#include <functional>
namespace server {

class WsRpc {
public:

    using Attachment = std::vector<char>;    


    struct Request {
        WsRpc &owner;
        Json params;
        std::vector<Attachment> attachments;
        std::string id;
        std::string method_name;

        void send_response(const Json &result, std::span<const Attachment> att = {}) const {
            owner.send_response(false, id, true, result, att);
        }        
        void send_error(int code, std::string_view message ) const {
            owner.send_error(id, code, message);
        }
    };


    template<typename Obj>
    using MethodDef = const std::pair<std::string_view, void (Obj::*)(const Request &req)>;



    template<typename Obj>
    using MethodList = std::span<const std::pair<std::string_view, void (Obj::*)(const Request &req)> >;

    class MethodMap : public std::unordered_map<std::string, std::function<void(const Request &req)> > {
    public:
        template<typename Obj, typename Ptr>
        void register_methods(Ptr ptr, MethodList<Obj> methods) {
            for (auto &[k,v]:methods) {
                this->try_emplace(std::string(k), [ptr, v](const Request &r){((*ptr).*v)(r);});
            }
        }
    };

    static std::optional<Stream> connect_ws_as_server(server::Request &req);


    WsRpc(Stream stream, const MethodMap &methods): _stream(std::move(stream)),_parser(_input), _method_map(methods) {}
    

    void run_service(std::stop_token tkn);

    void send_notify(std::string_view channel, const Json &data,const  std::span<const Attachment> &attach = {}) {
        send_response(true,channel, true, data, attach);
    }

protected:
    Stream _stream;
    ws::Parser<std::vector<char> > _parser;
    const MethodMap &_method_map;
    std::vector<char> _input;
    std::vector<char> _output;
    std::ostringstream _out_msg_buff;    
 

    std::mutex _mx;

    void send_response(bool is_notify, const std::string_view &id, bool success, const Json &result, const std::span<const Attachment> &attachments);
    void send_error(const std::string_view &id, int code, std::string_view message);

    bool send_message(const ws::Message &msg);
    std::optional<std::string_view> read_message(ws::Type type);
    
    void process_request(std::string_view text);

};

}