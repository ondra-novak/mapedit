#pragma once
#include <future>
#include <stop_token>
#include <optional>
#include <filesystem>


class SkeldalExeInstance {
public:


    static constexpr size_t stop_timeout = 30000;

    ~SkeldalExeInstance();

    std::stop_token start(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string addr_port, std::filesystem::path ddlpath);
    bool stop();

    bool is_running() const;

protected:

    std::future<void> _instance;
    std::stop_source _stop_src;

};


class SkeldalExeControl {
public:

    SkeldalExeControl(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string addr_port, std::function<void(std::string_view)> command_callback);

    
    void start(std::filesystem::path ddlpath);
    std::filesystem::path get_current_ddlpath() const;
    bool stop();
    void teleport_to(std::string_view map, int sector, int dir, bool dirty_ddl);



protected:

    struct Stopper {
        SkeldalExeControl *me;
        void operator()() {me->stop_requested();}
    };
    
    std::filesystem::path _root_dir;
    std::filesystem::path _cfgpath;
    std::string _addr_port;
    std::function<void(std::string_view)> _command_callback;
    std::filesystem::path _curddl_path;

    void stop_requested();
    std::optional<std::stop_callback<Stopper> > _stop_cb;
    SkeldalExeInstance _instance;
};

class SwapAndCopy {
public:

    SwapAndCopy(std::filesystem::path orig_ddl);
    SwapAndCopy(const SwapAndCopy &) = delete;
    SwapAndCopy &operator=(const SwapAndCopy &) = delete;
    operator const std::filesystem::path &() const;
    ~SwapAndCopy();

protected:
    std::filesystem::path _orig_ddl;
    std::filesystem::path _mapped_ddl;
};
