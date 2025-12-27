#pragma  once

#include "utils/json.hpp"
#include "wsrpc.hpp"
#include <mutex>
#include <string_view>
#include <vector>

namespace server {

struct WsPublisher {
        mutable std::mutex _mx;
        std::vector<WsRpc *> _subscribers = {};

        void publish(std::string_view channel, const Json &data);
        void register_client(WsRpc &client);
        bool unregister_client(WsRpc &client);
        bool empty() const;
    };

}