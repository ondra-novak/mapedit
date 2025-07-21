#pragma once

#include <filesystem>

namespace server {

struct Config {
    std::string addr_port;
    std::filesystem::path app_dir;
    std::filesystem::path asset_dir;
    std::filesystem::path game_folder;
    std::filesystem::path user_folder;
    std::filesystem::path game_ini;
    bool check_active;
};

}