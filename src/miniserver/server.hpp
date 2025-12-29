#pragma once

#include "utils/http_utils.hpp"
#include "utils/function_view.hpp"
#include "utils/unique_handle.hpp"
#include <queue>
#include <future>
#include "utils/json.hpp"
#include <vector>
#include <utility>
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


    struct StatusCode {
        int code = {};
        std::string_view message = {};
    };



    class Stream {
    public:
        Stream() = default;
        Stream(Socket sock):_socket(std::move(sock)) {}
        bool write(std::string_view data);
        void write_eof();
        std::string_view read();
        void put_back(std::string_view buff) {this->_buff = buff;}
        bool is_eof() const {return _read_eof;}
        bool is_timeout() const {return _read_timeout;}
    protected:
        Socket _socket;
        std::string_view _buff = {};
        std::unique_ptr<char[]> _buff_ptr  ={};
        bool _read_timeout = false;
        bool _read_eof = false;

        static constexpr std::size_t buffer_size = 4096;

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

        [[nodiscard]] bool operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, const char *body) {return this->operator()(code, hdr, std::string_view(body));}
        [[nodiscard]] bool operator()(StatusCode code, std::initializer_list<HeaderRow> hdr, const std::string &body) {return this->operator()(code, hdr, std::string_view(body));}
        [[nodiscard]] bool operator()(StatusCode code, std::initializer_list<HeaderRow>, std::string_view body);
        [[nodiscard]] bool operator()(StatusCode code, std::initializer_list<HeaderRow>, std::size_t sz, function_view<std::string_view()> body_gen);
        [[nodiscard]] bool operator()(StatusCode code, std::initializer_list<HeaderRow>, const Json &json);
        [[nodiscard]] bool operator()(StatusCode code, std::initializer_list<HeaderRow>, Stream &stream);        

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

        utils::HeaderValue header_get(utils::HeaderKey k) const;
    };
 
    class Server {
    public:

        using Handler = function_view<bool(BasicRequest &)>;

        Server(std::string address_port);
        void serve( Handler callback, std::stop_token tkn);        
        std::string get_listen_addr() const;

    protected:

        Socket _mother;
        std::atomic<unsigned int> _threads;

        bool process_request(Socket & socket,const Handler &handler) noexcept;
        template<typename Fn>
        bool parse_header(std::string_view data,Socket socket, Fn &&fn)  ;
        bool post_handler(BasicRequest &req, Socket &s);

    };


}