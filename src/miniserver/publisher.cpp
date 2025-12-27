#include "publisher.hpp"
#include <mutex>

namespace server {

void WsPublisher::publish(std::string_view channel, const Json &data) {
    std::lock_guard _(_mx);
    for (auto &x: _subscribers) {
        x->send_notify(channel, data);
    }
}
void WsPublisher::register_client(WsRpc &client) {
    std::lock_guard _(_mx);
    _subscribers.push_back(&client);
    
}
bool WsPublisher::unregister_client(WsRpc &client) {
    std::lock_guard _(_mx);
    auto iter = std::remove(_subscribers.begin(), _subscribers.end(), &client);
    _subscribers.erase(iter, _subscribers.end());
    return _subscribers.empty();
    
}
bool WsPublisher::empty() const {
    std::lock_guard _(_mx);
    return _subscribers.empty();    
}



}
