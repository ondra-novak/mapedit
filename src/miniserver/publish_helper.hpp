#pragma once


#include "ddlman.hpp"
#include "steamservice.hpp"
#include <chrono>
#include <filesystem>
#include <span>
#include <string>
#include <thread>
#include <vector>

class SteamService;

class PublishHelper {
public:

    PublishHelper(std::filesystem::path ddl_file);

    struct PublishState {
        uint64_t steam_id = 0;
        std::chrono::system_clock::time_point publish_time = {};
        std::vector<std::string> tags = {};
        unsigned int visibility = 0;
        std::vector<char> image = {};
        std::string image_content_type = {};
        std::string title = {};
        std::string description = {};
        std::string update_lang = {};
        std::string content_lang = {};
        std::string base_lang = {};
    };

    enum class PublishResult {
        invalid,
        ok,
        create_rejected,
        need_legal_agr
    };

    using PublishReturn = std::variant<PublishResult, std::jthread>;

    PublishState get_state() const;

    void set_metadata(std::string title,
                      std::string description,
                      std::string update_lang,
                      std::string content_lang,
                      std::string base_lang,
                      std::vector<std::string> tags,
                      unsigned int visibility);
    
    void set_image(std::span<const char> image, std::string_view content_type);

     PublishReturn publish(SteamService *steam, std::string change_desc, 
        std::function<void(bool running, int stage, float percent, int steam_error)> callback);

protected:
    std::filesystem::path _ddl;
    DDLManager _state;

    void store_state(const PublishState &st);
    static void create_ini(const std::filesystem::path &target, const PublishState &st);

    struct UploadResult {
        bool need_legal_aggr =false;
        int steam_error = 0;
        bool upload_success = false;
        std::atomic<bool> done=  {};
    };

};