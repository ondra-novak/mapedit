#pragma once


#include "ddlman.hpp"
#include <chrono>
#include <filesystem>
#include <span>
#include <string>
#include <thread>
#include <vector>

class SteamService;

class PublishHelper {
public:

    explicit PublishHelper(std::filesystem::path ddl_file);
    explicit PublishHelper(const DDLManager &ddl_file);

    struct State {
        uint64_t steam_id = 0;
        std::chrono::system_clock::time_point publish_time = {};
        bool need_licence;
    };
    
    struct SteamData {
        unsigned int visibility = 0;
        std::vector<std::string> tags = {};        
    };

    struct ContentData {
        std::string title = {};
        std::string description = {};
        std::string update_lang = {};   //language used for update message
        std::string content_lang = {};  //language of content (added as tag)
        std::string base_lang = {};     //language of UI (CS or EN)
        std::string author = {};
    };

    State get_state() const;
    SteamData get_steam_data() const;
    void set_steam_data(const SteamData &data);
    void update_content_data(const ContentData &data);
    std::pair<std::string, std::vector<char> > get_preview_image() const;
    void set_preview_image(std::span<const char> image, std::string_view content_type);
    void set_ingame_preview_image(std::span<const char> hi_image);
    void prepare_for_publish(std::string_view changelog);
    
    

protected:
    std::filesystem::path _ddl;
    std::filesystem::path _steam_state;
    DDLManager _state;    
};