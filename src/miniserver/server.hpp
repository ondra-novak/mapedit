#pragma once

#include "utils/http_utils.hpp"
#include "utils/function_view.hpp"
#include "utils/unique_handle.hpp"
#include <json/value.h>
#include <vector>
#include <variant>
#include <utility>
#include <functional>
#include <span>




namespace server {

    #ifdef _WIN32
    using SocketType = std::uintptr_t;
    #else
    using SocketType = int;
    #endif

    struct HandleDeleter {            
        void operator()(SocketType);
    };
    using Socket =  unique_handle<SocketType , HandleDeleter>;

    class IReader {
    public:
        virtual ~IReader() = default;
        virtual std::size_t size() const = 0;
        virtual std::string_view read() = 0;
    };

    template<typename Fn>
    requires(std::is_invocable_r_v<std::string_view, Fn>)
    class CBReader: public IReader {
    public:
        CBReader(std::size_t sz, Fn &&fn):_sz(sz), _fn(std::forward<Fn>(fn)) {}
        virtual std::size_t size() const {return _sz;}
        virtual std::string_view read() {
            return _fn();
        }
        
    protected:
        std::size_t _sz;
        std::decay_t<Fn> _fn;
        
    };

    struct HeaderRow {
        utils::HeaderKey key;
        std::string_view value;
        auto operator<=>(const HeaderRow &) const = default;
        bool operator==(const HeaderRow &) const = default;
    };

/*
    class ResponseBody : public std::variant<std::string_view, std::unique_ptr<IReader>, json::value > {
    public:

        using super = std::variant<std::string_view, std::unique_ptr<IReader>, json::value >;
        template<typename Fn>
        requires(std::is_invocable_r_v<std::string_view, Fn>)
        ResponseBody(std::size_t sz, Fn &&fn):super(std::unique_ptr<IReader>(std::make_unique<CBReader<Fn> >(sz, std::forward<Fn>(fn)))) {}
        template<typename T>
        requires(std::is_constructible_v<std::string_view, T>)
        ResponseBody(T &&body):super(std::string_view(body)) {}
        template<typename T>
        requires(std::is_constructible_v<json::value, T> && !std::is_constructible_v<std::string_view, T>)
        ResponseBody(T &&body):super(std::in_place_type<json::value>,std::forward<T>(body)) {}
    };
*/
    struct StatusCode {
        int code = {};
        std::string_view message = {};
    };



    class Stream {
    public:
        Stream() = default;
        Stream(Socket sock):_socket(std::move(sock)) {prepare_socket();}
        bool operator()(std::string_view data);
    protected:
        Socket _socket;
        void prepare_socket();

    };

    class Response {
    public:

        struct Context {
            Socket socket;
            bool complete = false;
        };

        Response() = default;
        Response(Context &context):_ctx(&context) {}

        bool is_complete() const {return _ctx?_ctx->complete:false;}

        bool operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, const char *body) {return this->operator()(code, hdr, std::string_view(body));}
        bool operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, const std::string &body) {return this->operator()(code, hdr, std::string_view(body));}
        bool operator()(StatusCode code, std::initializer_list<HeaderRow>, std::string_view body);
        bool operator()(StatusCode code, std::initializer_list<HeaderRow>, std::size_t sz, function_view<std::string_view()> body_gen);
        bool operator()(StatusCode code, std::initializer_list<HeaderRow>, const json::value &json);
        bool operator()(StatusCode code, std::initializer_list<HeaderRow>, Stream &stream);        

        Socket release_socket() {
            if (_ctx) {
                return std::move(_ctx->socket);
            } else {
                return {};
            }
                
        }
    protected:
        Context *_ctx;
        
        bool send_response(StatusCode code, std::initializer_list<std::initializer_list<HeaderRow> > hdrs, std::optional<std::size_t> body_size, function_view<std::string_view()> body_gen);

    };
    /*

    using Response = Function<bool(StatusCode,
                        std::initializer_list<HeaderRow>,
                        ResponseBody), 4*sizeof(void *)>;
*/
    struct BasicRequest {
        utils::HeaderKey method;
        std::string_view path;
        std::string_view protocol;
        std::span<const HeaderRow> headers;
        std::string_view body;    
        std::size_t body_size;    
        Response response;
    };
 
    class Server {
    public:

        using Handler =  std::function<void(BasicRequest &)>;

        Server(std::string address_port);
        void listen(Handler callback);
        std::string get_listen_addr() const;

    protected:


        Socket _mother;

        bool process_request(Socket & socket,const Handler &handler);
        template<typename Fn>
        bool parse_header(std::string_view data,Socket socket, Fn &&fn)  ;
        bool post_handler(BasicRequest &req, Socket &s);

    };


}