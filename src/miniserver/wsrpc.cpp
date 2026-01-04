#include "wsrpc.hpp"
#include "handler_map.hpp"
#include "utils/http_utils.hpp"
#include "utils/websocket.h"
#include <cstddef>
#include <cstdlib>
#include <mutex>
#include <optional>
#include <sstream>
#include <stop_token>

namespace server {


void WsRpc::run_service(std::stop_token tkn) {
    auto msg = read_message(ws::Type::text);
    std::stop_callback _(tkn,[&]{
        _stream.write_eof();
    });
    while (msg) {
        process_request(*msg);
        msg = read_message(ws::Type::text);
    }
}

void WsRpc::send_response(bool is_notify, const std::string_view &id, bool success, const Json &result, const std::span<const Attachment> &attachments) {
    std::lock_guard _(_mx);
    _out_msg_buff << attachments.size() << '\n';
    if (is_notify) _out_msg_buff << '#';
    _out_msg_buff << id << '\n';
    _out_msg_buff << (success?'1':'0') << '\n';
    result.serialize([&](char c){_out_msg_buff.put(c);});
    bool r = send_message({std::move(_out_msg_buff).str(), ws::Type::text});
    if (!r) return;
    for (auto &x: attachments) {
        r = send_message({{x.data(),x.size()}, ws::Type::binary});
        if (!r) return;
    }
}

void WsRpc::send_error(const std::string_view &id, int code, std::string_view message) {
    send_response(false, id, false, {
        {"code", code},
        {"message",message}
    }, {});
}


void WsRpc::process_request(std::string_view text) {
    auto attc = utils::split_at(text,"\n");;
    std::string id(utils::split_at(text,"\n"));
    std::string method(utils::split_at(text, "\n"));
    auto params = Json::from_string(text);
    auto attcnt = std::strtoul(attc.data(),nullptr, 10);
    std::vector<Attachment> attlist;
    attlist.reserve(attcnt);
    for (unsigned long i = 0; i < attcnt; ++i) {
        auto x = read_message(ws::Type::binary);
        if (!x) return;
        attlist.push_back({x->begin(), x->end()});        
    }
    auto iter = _method_map.find(method);
    Request req{*this, std::move(params), std::move(attlist), std::move(id), std::move(method)};
    if (iter == _method_map.end()) {
        req.send_error(404, "Method not found");
    } else {
        try {
            iter->second(req);
        } catch (std::exception &e) {
            req.send_error(500, e.what());
        }
    }
}

bool WsRpc::send_message(const ws::Message &msg) {
    _output.clear();
    ws::build(msg, [&](char c){_output.push_back(c);});
    return _stream.write({_output.begin(), _output.end()});
}
std::optional<std::string_view> WsRpc::read_message(ws::Type type) {
    do {
        bool ping = true;
        _parser.reset();
        bool done = false;
        while (!done) {
            auto data = _stream.read();
            if (data.empty()) {
                if (_stream.is_timeout() && ping) {
                    send_message({{},ws::Type::ping});
                    ping = false;
                }  else {
                    return std::nullopt;
                }            
            }
            done = _parser.push_data(data);
        }        
        _stream.put_back(_parser.get_unused_data());

        auto msg = _parser.get_message();
        if (msg.type == type) return msg.payload;
        if (msg.type != ws::Type::pong) {
            if (msg.type != ws::Type::ping) return std::nullopt;
            send_message({msg.payload, ws::Type::pong});
        }
    } while (true);

}

std::optional<Stream> WsRpc::connect_ws_as_server(server::Request &req) {
    auto conn = req.header_get("Connection");
    auto upg = req.header_get("Upgrade");
    auto wskey = req.header_get("Sec-WebSocket-Key");
    auto wsver = req.header_get("Sec-WebSocket-Version");
    if (req.method != Method::GET || !conn || !upg || !wskey || !wsver) return std::nullopt;
    utils::HeaderKey kconn(*conn);
    utils::HeaderKey kupg(*upg);
    auto ver = std::strtoul(wsver->data(),nullptr,10);

    if (kconn != "upgrade" || kupg != "websocket" || ver < 13) return std::nullopt;

    auto acceptstr = ws::calculate_ws_accept(*wskey);
    Stream out;
    if (!req.response({101},{
        {"Upgrade","websocket"},
        {"Connection","upgrade"},
        {"Sec-WebSocket-Accept", acceptstr}
    },out))  return std::nullopt;
    return {std::move(out)};
    
    ;
}

}