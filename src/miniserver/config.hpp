#pragma once

#include "steamservice.hpp"
#include <filesystem>

namespace server {

struct Config {
    std::string addr_port;
    std::filesystem::path user_folder;
    bool check_active;
};

}