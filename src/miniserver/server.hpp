#pragma once

#include "utils/http_utils.hpp"
#include "utils/inline_function.hpp"
#include "utils/unique_handle.hpp"
#include <vector>
#include <variant>
#include <utility>
#include <functional>
#include <span>


namespace server {

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


    class ResponseBody : public std::variant<std::string_view, std::unique_ptr<IReader> > {
    public:

        using super = std::variant<std::string_view, std::unique_ptr<IReader> >;
        template<typename Fn>
        requires(std::is_invocable_r_v<std::string_view, Fn>)
        ResponseBody(std::size_t sz, Fn &&fn):super(std::unique_ptr<IReader>(std::make_unique<CBReader<Fn> >(sz, std::forward<Fn>(fn)))) {}
        template<typename T>
        requires(std::is_constructible_v<std::string_view, T>)
        ResponseBody(T body):super(std::string_view(body)) {}
    };

    struct StatusCode {
        int code = {};
        std::string_view message = {};
    };

    

    using Response = Function<bool(StatusCode,
                        std::initializer_list<HeaderRow>,
                        ResponseBody), 4*sizeof(void *)>;

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

    protected:


        struct HandleDeleter {void operator()(int);};
        using Socket =  unique_handle<int, HandleDeleter>;
        Socket _mother;

        struct SendCallback {
            Socket socket;
            bool complete = false;
            bool operator()(StatusCode st,std::initializer_list<HeaderRow> hdr,ResponseBody body)            ;
        };

        bool process_request(Socket & socket,const Handler &handler);
        template<typename Fn>
        bool parse_header(std::string_view data,Socket socket, Fn &&fn)  ;
        bool post_handler(BasicRequest &req, Socket &s);

    };


}