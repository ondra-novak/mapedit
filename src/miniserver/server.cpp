#include "server.hpp"
#include "utils/stack_alloc.hpp"
#include "utils/http_utils.hpp"

#include <json/serializer.h>
#include <fcntl.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/timerfd.h>
#include <unistd.h>
#include <netdb.h>
#include <string>
#include <format>
#include <stdexcept>
#include <system_error>
#include <thread>
#include <format>

namespace server
{

    int create_listening_socket(const std::string &address_port)
    {
        std::string host;
        std::string port;

        size_t colon_pos = address_port.rfind(':');
        if (colon_pos == std::string::npos || colon_pos == address_port.length() - 1)
        {
            throw std::invalid_argument(
                "Invalid address format. Expected format: [host]:port or :port");
        }

        host = address_port.substr(0, colon_pos);
        port = address_port.substr(colon_pos + 1);

        addrinfo hints{};
        hints.ai_family = AF_UNSPEC;     // IPv4 nebo IPv6
        hints.ai_socktype = SOCK_STREAM; // TCP
        hints.ai_flags = AI_PASSIVE;     // Pro listen socket

        addrinfo *result;
        int ret = getaddrinfo(host.empty() ? nullptr : host.c_str(), port.c_str(),
                              &hints, &result);
        if (ret != 0)
        {
            throw std::system_error(0, std::generic_category(),
                                    std::string("getaddrinfo: ") + gai_strerror(ret));
        }

        int sockfd = -1;
        for (addrinfo *rp = result; rp != nullptr; rp = rp->ai_next)
        {
            sockfd = socket(rp->ai_family,
                            rp->ai_socktype | SOCK_CLOEXEC,
                            rp->ai_protocol);
            if (sockfd == -1)
                continue;

            int opt = 1;
            setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

            if (bind(sockfd, rp->ai_addr, rp->ai_addrlen) == 0)
            {
                if (listen(sockfd, SOMAXCONN) == 0)
                {
                    freeaddrinfo(result);
                    return sockfd;
                }
            }

            // jinak zavřít a zkusit další
            ::close(sockfd);
            sockfd = -1;
        }

        freeaddrinfo(result);
        throw std::system_error(errno, std::generic_category(),
                                "Failed to bind and listen on any address");
    }

    static bool send_block(int socket, std::string_view data)
    {
        while (!data.empty())
        {
            int r = send(socket, data.data(), data.size(), MSG_NOSIGNAL);
            if (r <= 0)
                return false;
            data = data.substr(r);
        }
        return true;
    }

    Server::Server(std::string address_port) : _mother(create_listening_socket(address_port), {})
    {
    }

    std::string Server::get_listen_addr() const
    {
        sockaddr_storage addr;
        socklen_t len = sizeof(addr);
        if (getsockname(_mother.get(), reinterpret_cast<sockaddr *>(&addr), &len) == -1) {
            throw std::system_error(errno, std::system_category(), "getsockname failed");
        }

        char host[NI_MAXHOST], service[NI_MAXSERV];
        int res = getnameinfo(reinterpret_cast<sockaddr *>(&addr), len,
                              host, sizeof(host), service, sizeof(service),
                              NI_NUMERICHOST | NI_NUMERICSERV);
        if (res != 0) {
            throw std::system_error(0, std::generic_category(),
                                    std::string("getnameinfo: ") + gai_strerror(res));
        }

        std::string result;
        if (addr.ss_family == AF_INET6) {
            result = std::format("[{}]:{}", host, service);
        } else {
            result = std::format("{}:{}", host, service);
        }
        return result;
    }

    template <typename Fn>
    bool Server::parse_header(std::string_view data, Socket socket, Fn &&fn)
    {
        BasicRequest req;

        auto fline = utils::split_at(data, "\r\n");
        utils::HeaderKey method = utils::split_at(fline, " ");
        auto path = utils::split_at(fline, " ");
        utils::HeaderKey protocol = fline;

        if (protocol != "HTTP/1.1")
            return false;

        int rows = 0;
        for (auto tmp = data; !tmp.empty(); utils::split_at(tmp, "\r\n"))
            ++rows;
        return utils::stack_alloc<HeaderRow>(rows, [&](HeaderRow *list)
                                             {
        auto iter = list;
        while (!data.empty()) {
            auto val = utils::split_at(data, "\r\n");
            iter->key = utils::trim(utils::split_at(val, ":"));
            iter->value = utils::trim(val);
            ++iter;
        }

        std::sort(list,iter);
        req.body_size = 0;
        if (method != "GET" && method != "HEAD") {
            utils::HeaderKey ctl("Content-Length");
            auto lwiter = std::lower_bound(list,iter, HeaderRow{ctl,{}});
            if (lwiter != iter && lwiter->key == ctl) {
                req.body_size = std::strtoul(lwiter->value.data(), nullptr,10);
            }
        }
        req.headers = {list,iter};
        req.method = method;
        req.path = path;
        req.protocol = protocol;    
        req.response = SendCallback{std::move(socket)};        
        
        return fn(req); });
    }

    bool Server::post_handler(BasicRequest &req, Socket &s)
    {
        SendCallback *resp = req.response.get_clousure<SendCallback>();
        if (resp->socket.has_value() && resp->complete)
        {
            s = std::move(resp->socket);
            return true;
        }
        return false;
    }

    bool Server::process_request(Socket &socket, const Handler &handler)
    {
        std::string read_buffer;
        while (true)
        {
            auto sz = read_buffer.size();
            read_buffer.resize(sz + 4096);
            int r = recv(socket.get(), read_buffer.data() + sz, read_buffer.size() - sz, MSG_NOSIGNAL);
            if (r < 0)
            {
                int e = errno;
                if (e != EINTR)
                    return false;
            }
            else if (r == 0)
            {
                return false;
            }
            else
            {
                read_buffer.resize(sz + r);
                auto n = read_buffer.find("\r\n\r\n");
                if (n != std::string::npos)
                {
                    int sck = socket.get();
                    return parse_header(std::string_view(read_buffer).substr(0, n + 2), std::move(socket), [&](BasicRequest &req)
                                        {
                    if (req.body_size) {
                        return utils::stack_alloc<char>(req.body_size,[&](char *buffer){                            
                            char *iter = buffer;
                            char *end = iter+req.body_size;
                            int s = n+4;
                            std::size_t remain_size = std::min(read_buffer.size() - s, req.body_size);
                            iter = std::copy(read_buffer.data()+s, read_buffer.data()+s+remain_size, buffer);
                            while (iter != end) {
                                int r = recv(sck, iter, end - iter, MSG_NOSIGNAL);
                                if (r < 0) {
                                    int e = errno;
                                    if (e != EINTR) return false;
                                } else if (r == 0) {
                                    return false;
                                } else {
                                    iter+=r;
                                }
                            }
                            req.body = {buffer, req.body_size};
                            handler(req);
                            return post_handler(req,socket);
                        });
                    } else {
                        handler(req);
                        return post_handler(req,socket);
                    } });
                }
            }
        }

        return false;
    }

    void Server::listen(std::function<void(BasicRequest &)> callback)
    {
        while (true)
        {
            int sock = accept4(_mother.get(), 0, 0, SOCK_CLOEXEC);
            if (sock == -1)
            {
                int e = errno;
                if (e != EINTR)
                {
                    throw std::system_error(e, std::system_category(), "accept failed");
                }
            }
            std::thread thr([this, callback, sock]
                            {
            Socket socket(sock, {});
            while (process_request(socket, callback)); });
            thr.detach();
        }
    }

    void Server::HandleDeleter::operator()(int fd)
    {
        ::close(fd);
    }

    constexpr std::string_view content_type("Content-Type");
    constexpr std::string_view application_json("application/json");

    bool Server::SendCallback::operator()(StatusCode status, std::initializer_list<HeaderRow> headers, ResponseBody body)
    {
        std::size_t req_size = 64 + status.message.size() + (std::holds_alternative<json::value>(body) ? (content_type.size() + application_json.size() + 4) : std::size_t(0));

        for (const auto &[key, value] : headers)
        {
            req_size += key.size() + value.size() + 4;
        };

        req_size += 2;
        return utils::stack_alloc<char>(req_size, [&](char *buffer)
                                        {
        char *iter = buffer;
        iter = std::format_to(iter, "HTTP/1.1 {} {}\r\n", status.code, status.message);
        for (const auto &[key, value]: headers) {
            iter = std::format_to(iter, "{}: {}\r\n", static_cast<std::string_view>(key), value);                                    
        }
        std::string json_data;        
        std::size_t content_length = 0;
        if (std::holds_alternative<std::string_view>(body)) {
            content_length = std::get<std::string_view>(body).size();
        } else if (std::holds_alternative<json::value>(body)) {
            const auto &js = std::get<json::value>(body);
            json_data = js.to_json();
            content_length = json_data.size();
            iter = std::format_to(iter, "{}: {}\r\n", content_type, application_json);                                
        } else {
            content_length = std::get<std::unique_ptr<IReader> >(body)->size();
        }  
        
        bool nobody = status.code == 204 || status.code == 304;

        if (!nobody) {
            iter = std::format_to(iter, "Content-Length: {}\r\n", content_length);                                
        }
        iter = std::format_to(iter, "\r\n");


        if (!send_block(socket.get(), {buffer, iter})) return false;

        if (nobody) {
            complete = true;
            return true;
        }

        if (std::holds_alternative<std::string_view>(body)) {
            return complete =  send_block(socket.get(), std::get<std::string_view>(body));
        } else if (std::holds_alternative<json::value>(body)) {        
            return complete =  send_block(socket.get(), json_data);
        } else {
            auto &rd = std::get<std::unique_ptr<IReader> >(body);
            while (content_length) {
                auto s = rd->read().substr(0, content_length);
                if (!send_block(socket.get(), s)) return false;
                content_length -= s.size();
            }   
            complete = true;
            return true;
        } });
    }

}