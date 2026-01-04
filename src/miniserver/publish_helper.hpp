#pragma once


#include <chrono>
#include <filesystem>
#include <span>
#include <string>
#include <vector>
class PublishHelper {
public:

    PublishHelper(std::filesystem::path game_folder);

    struct PublishState {
        std::string steam_id = {};
        std::chrono::system_clock::time_point publish_time = {};
        std::vector<std::string> tags = {};
        unsigned int visibility = 0;
        std::filesystem::path state_file = {};
    };

    PublishState get_state(std::filesystem::path ddl_file); 

    std::pair<std::vector<char>, std::string> get_image(std::filesystem::path ddl_file);

    void set_image(std::filesystem::path ddl_file, std::span<const char> image, std::string_view content_type);

    void publish(std::filesystem::path ddl_file, 
        std::string title, 
        std::string description, 
        std::string lang,
        std::span<const std::string> tags,
        unsigned int visibility, 
        std::string change_desc);

protected:
        std::filesystem::path _game_folder;


};