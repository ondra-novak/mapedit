#pragma once
#include "utils/process.hpp"
#include <chrono>
#include <future>
#include <span>
#include <stop_token>
#include <optional>
#include <filesystem>
#include <string_view>


class SkeldalExeInstance {
public:


    static constexpr size_t stop_timeout = 30000;

    ~SkeldalExeInstance();

    void start_preview(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string addr_port, std::filesystem::path ddlpath);
    void start_publish(std::filesystem::path root_dir, std::filesystem::path packfile);

    bool wait_stop(std::chrono::steady_clock::duration dur);

    bool is_running() const;




protected:
    mutable Process  _proc;

    

};


class SkeldalExeControl {
public:

    SkeldalExeControl(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string addr_port, std::function<void(std::string_view)> command_callback);

    
    void start(std::filesystem::path ddlpath);
    void publish(std::filesystem::path ddlpath);
    std::filesystem::path get_current_ddlpath() const;
    bool stop();
    void teleport_to(std::string_view map, int sector, int dir, int ghost_form_flag);
    void reload_map();
    void console_show(bool show);
    void console_exec(std::string_view cmd);
    void test_dialog(int id);



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

