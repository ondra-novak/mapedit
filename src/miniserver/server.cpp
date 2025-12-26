#include "server.hpp"
#include "utils/stack_alloc.hpp"
#include "utils/http_utils.hpp"

#include <algorithm>
#include <cerrno>
#include <memory>
#include <optional>
#include <string>
#include <format>
#include <stdexcept>
#include <system_error>
#include <thread>
#include <format>
#include <fcntl.h>
#include <utility>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <WinSock2.h>
#include <WS2tcpip.h>
constexpr int SOCK_CLOEXEC = 0;
constexpr int MSG_NOSIGNAL = 0;
constexpr int MSG_DONTWAIT = 0;
constexpr int SHUT_RD = SD_RECEIVE;
constexpr int SHUT_WR = SD_SEND;
constexpr DWORD WOULDBLOCK = WSA_WOULDBLOCK;
#pragma comment(lib, "ws2_32.lib")

inline bool wait_read(SOCKET s, int timeout) {
    pollfd fd = {};
    fd.events = POLLIN;
    fd.fd = s;
    return poll(&fd,1,timeout) != 0;
}
inline bool wait_write(SOCKET s, int timeout) {
    pollfd fd = {};
    fd.events = POLLOUT;
    fd.fd = s;
    return poll(&fd,1,timeout) != 0;
}



#else 
#include <poll.h>
#include <sys/socket.h>
#include <poll.h>
#include <unistd.h>
#include <netdb.h>
using SOCKET = int;
constexpr SOCKET INVALID_SOCKET = -1;
inline void closesocket(SOCKET s) {::close(s);}

inline bool wait_read(SOCKET s, int timeout) {
    pollfd fd = {};
    fd.events = POLLIN;
    fd.fd = s;
    return poll(&fd,1,timeout) != 0;
}
inline bool wait_write(SOCKET s, int timeout) {
    pollfd fd = {};
    fd.events = POLLOUT;
    fd.fd = s;
    return poll(&fd,1,timeout) != 0;
}
constexpr int WOULDBLOCK = EWOULDBLOCK;


#endif

namespace server
{

    #ifdef _WIN32
    class network_category_t : public std::error_category {
    public:
        const char* name() const noexcept override {
            return "winsock";
        }
        std::string message(int ev) const override {
            char *msg = nullptr;
            FormatMessageA(
                FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
                nullptr, ev, MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
                (LPSTR)&msg, 0, nullptr);
            std::string result = msg ? msg : "Unknown Winsock error";
            if (msg) LocalFree(msg);
            return result;
        }
    };

    inline const std::error_category& network_category() {
        static network_category_t cat;
        return cat;
    }

    inline int getLastNetError() {
        return static_cast<int>(WSAGetLastError());
    }

    inline void ensure_winsock_initialized() {
        static bool initialized = [] {
            WSADATA wsaData;
            int res = WSAStartup(MAKEWORD(2, 2), &wsaData);
            if (res != 0) {
                throw std::system_error(res, network_category(), "WSAStartup failed");
            }
            return true;
        }();
        (void)initialized;
    }

    #else 
    
        inline const std::error_category& network_category() {
            return std::system_category();
        }
        inline int getLastNetError() {
            return errno;
        }
        inline void ensure_winsock_initialized() {
                //empty
        }


    #endif

    

    SOCKET create_listening_socket(const std::string &address_port)
    {
        ensure_winsock_initialized();
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
            throw std::system_error(0, network_category(),
                                    std::string("getaddrinfo: ") + gai_strerror(ret));
        }

        SOCKET sockfd = INVALID_SOCKET;
        for (addrinfo *rp = result; rp != nullptr; rp = rp->ai_next)
        {
            sockfd = socket(rp->ai_family,
                            rp->ai_socktype | SOCK_CLOEXEC,
                            rp->ai_protocol);
            if (sockfd == -1)
                continue;

#ifndef _WIN32
            int opt = 1;
            setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif
            if (bind(sockfd, rp->ai_addr, static_cast<int>(rp->ai_addrlen)) == 0)
            {
                if (listen(sockfd, SOMAXCONN) == 0)
                {
                    freeaddrinfo(result);
                    return sockfd;
                }
            }

            // jinak zavřít a zkusit další
            closesocket(sockfd);
            sockfd = INVALID_SOCKET;
        }

        freeaddrinfo(result);
        throw std::system_error(getLastNetError(), network_category(),
                                "Failed to bind and listen on any address");
    }

    static bool send_block(SOCKET socket, std::string_view data)
    {
        while (!data.empty())
        {
            int r = send(socket, data.data(), static_cast<int>(data.size()), MSG_NOSIGNAL);
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
            throw std::system_error(getLastNetError(), network_category(), "getsockname failed");
        }

        char host[NI_MAXHOST], service[NI_MAXSERV];
        int res = getnameinfo(reinterpret_cast<sockaddr *>(&addr), len,
                              host, sizeof(host), service, sizeof(service),
                              NI_NUMERICHOST | NI_NUMERICSERV);
        if (res != 0) {
            throw std::system_error(0, network_category(),
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

        Response::Context ctx {std::move(socket), false};

        req.headers = {list,iter};
        req.method = method;
        req.path = path;
        req.protocol = protocol;    
        req.response = Response{ctx};        
        
        return fn(req); });
    }

    bool Server::post_handler(BasicRequest &req, Socket &s)
    {
        if (req.response.is_complete()) {
            Socket q = req.response.release_socket();
            if (q) {
                s = std::move(q);
                return true;
            }
        }
        return false;
    }

    bool Server::process_request(Socket &socket, const Handler &handler) noexcept
    {
        std::string read_buffer;
        try {
            while (true)
            {
                auto sz = read_buffer.size();
                read_buffer.resize(sz + 4096);
                int r = recv(socket.get(), read_buffer.data() + sz, static_cast<int>(read_buffer.size() - sz), MSG_NOSIGNAL);
                if (r < 0)
                {
                    int e = getLastNetError();
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
                        SOCKET sck = socket.get();
                        return parse_header(std::string_view(read_buffer).substr(0, n + 2), std::move(socket), [&](BasicRequest &req)
                                            {
                        if (req.body_size) {
                            return utils::stack_alloc<char>(req.body_size,[&](char *buffer){                            
                                char *iter = buffer;
                                char *end = iter+req.body_size;
                                auto s = n+4;
                                std::size_t remain_size = std::min(read_buffer.size() - s, req.body_size);
                                iter = std::copy(read_buffer.data()+s, read_buffer.data()+s+remain_size, buffer);
                                while (iter != end) {
                                    int r = recv(sck, iter, static_cast<int>(end - iter), MSG_NOSIGNAL);
                                    if (r < 0) {
                                        int e = getLastNetError();
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
        } catch (...) {
            return false;
        }

        return false;
    }

    void Server::serve(Handler callback, std::stop_token tkn)
    {
        std::stop_callback stpcb(tkn,[&]{
            shutdown(_mother.get(), SHUT_RD);
        });


        while (!tkn.stop_requested())
        {
            #ifdef _WIN32
                SOCKET sock = accept(_mother.get(),0,0);
            #else
            SOCKET sock = accept4(_mother.get(), 0, 0, SOCK_CLOEXEC);
            #endif
            if (sock == -1)
            {
                int e = getLastNetError();
                if (e != EINTR)
                {
                    if (!tkn.stop_requested()) {
                        throw std::system_error(e, network_category(), "accept failed");
                    }
                }
            }

            std::thread thr([this, callback, sock, tkn] {

                std::stop_callback stpcb(tkn,[sock]{
                    shutdown(sock, SHUT_RD);
                });

                Socket socket(sock, {});
                _threads.fetch_add(1,std::memory_order_relaxed);
                
                while (!tkn.stop_requested() && process_request(socket, callback)); 

                if (_threads.fetch_sub(1,std::memory_order_relaxed) == 1) {
                    _threads.notify_all();
                }
            });
            thr.detach();            
        }

        unsigned int tcount = _threads.load(std::memory_order_relaxed);
        while (tcount) {
            _threads.wait(tcount);
            tcount = _threads.load(std::memory_order_relaxed);
        }

    }

    void HandleDeleter::operator()(SocketType fd)
    {
        closesocket(fd);
    }


    bool Response::operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, std::string_view body)
    {
        return send_response(code, {hdr}, body.size(), [body](){return body;});
    }

    bool Response::operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, std::size_t sz, function_view<std::string_view()> body_gen)
    {
        return send_response(code, {hdr}, sz, body_gen);        
    }

    bool Response::operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, const Json &json)
    {
        std::string jstr = json.to_string();
        return send_response(code, {hdr, {{"Content-Type", "application/json"}}},jstr.size(), [&](){return std::string_view(jstr);});        
    }

    bool Response::operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, Stream &stream)
    {
        if (send_response(code, {hdr}, std::nullopt, []{return std::string_view();})) {
            stream = Stream(std::move(_ctx->socket));
            return true;
        }
        return false;
    }

    bool Response::send_response(StatusCode st, std::initializer_list<std::initializer_list<HeaderRow>> hdrs, std::optional<std::size_t> body_size, function_view<std::string_view()> body_gen)
    {
        std::size_t hdr_sz = 64 + st.message.size();
        for (const auto &h: hdrs) {
            for (const auto &[k,v]: h) {
                hdr_sz += k.size() + v.size()+4;
            }
        }
        return utils::stack_reserve(hdr_sz, [&](void *bvoid){
            char *buffer = static_cast<char *>(bvoid);

            char *iter = buffer;
            iter = std::format_to(iter, "HTTP/1.1 {} {}\r\n", st.code, st.message);
            for (const auto &h: hdrs) {
                for (const auto &[key, value]: h) {
                    iter = std::format_to(iter, "{}: {}\r\n", static_cast<std::string_view>(key), value);    
                }
            }
            bool nobody = st.code == 204 || st.code == 304;

            if (!nobody) {
                if  (body_size) {
                    iter = std::format_to(iter, "Content-Length: {}\r\n", *body_size);
                } else {
                    iter = std::format_to(iter, "Connection: close\r\n");
                }
            } 
            iter = std::format_to(iter, "\r\n");
        
            if (!send_block(_ctx->socket.get(), {buffer, iter})) return false;

            if (!body_size) {
                auto data = body_gen();
                while (!data.empty()) {
                    if (!send_block(_ctx->socket.get(), data)) return false;
                    data = body_gen();
                }
                return true;
            } else {
                std::size_t remain = *body_size;;
                while (remain) {
                    auto data = body_gen().substr(0,remain);
                    if (data.empty()) return false;
                    if (!send_block(_ctx->socket.get(), data)) return false;
                    remain -= data.size();
                }
                _ctx->complete = true;
                return true;
            }
        });
    }



    bool Stream::write(std::string_view data)
    {
        while (data.size()) {
            int r = ::send(_socket.get(), data.data(), static_cast<int>(data.size()), MSG_DONTWAIT|MSG_NOSIGNAL);
            if (r < 1) {
                auto e = getLastNetError();
                if (e == WOULDBLOCK && wait_write(_socket.get(), 1000)) continue;
                return false;
            }

            data = data.substr(r);
        }        
        return true;
    }

    void Stream::write_eof() {
        ::shutdown(_socket.get(), SHUT_WR);
    }

    std::string_view Stream::read() {
        _read_timeout = false;
        if (!buff.empty() || _read_eof) return std::exchange(buff, {});
        if (!buff_ptr) buff_ptr = std::make_unique<char[]>(buffer_size);
        do {
            int r = ::recv(_socket.get(), buff_ptr.get(), static_cast<int>(buffer_size), MSG_DONTWAIT|MSG_NOSIGNAL);
            if (r < 0) {
                auto e = getLastNetError();
                if (e == WOULDBLOCK) {
                    if (wait_read(_socket.get(), 30000)) continue;
                    _read_timeout = true;
                } else {
                    _read_eof = true;
                }
                return {};
            } else if (r == 0) {
                _read_eof = true;
                return {};
            } else {
                return {buff_ptr.get(), static_cast<std::size_t>(r)};
            }
        } while (true);
    }

    void Stream::prepare_socket()
    {
        #ifdef _WIN32
            SOCKET s = _socket.get();
            u_long mode = 1;
            ioctlsocket(s, FIONBIO, &mode);
        #endif
    }

 
    utils::HeaderValue BasicRequest::header_get(utils::HeaderKey k) const {
        auto iter = std::lower_bound(headers.begin(), headers.end(), HeaderRow{k, {}});
        if (iter == headers.end() || iter->key != k) return std::nullopt;
        return iter->value;
    }
}