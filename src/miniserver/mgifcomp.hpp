#pragma once

#include "utils/mgifcreate.hpp"
#include <string>
#include <vector>
#include <memory>
#include <utility>
#include <chrono>

class MGifComp {
public:

    struct Status {
        bool processed;
        std::string reason;
        MGIFCreator::Need need;
    };

    struct Session {
        std::string uuid = {};
        std::string name = {};
        int group = 0;
        std::unique_ptr<MGIFCreator> creator = {};
        std::chrono::system_clock::time_point last_activity = {};
        bool transp_color =false;
    };

    std::string create_mgif(std::string name,int group, int frames, bool transp_color);
    Status put_image_pcx(std::string session, std::string_view pcx_image);
    Session close(std::string session);


protected:

    static std::string gen_uuid();
    std::vector<Session> _sessions;


};