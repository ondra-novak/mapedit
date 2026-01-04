#include "publish_helper.hpp"
#include "ddlman.hpp"
#include "utils/json.hpp"
#include <chrono>
#include <cstdio>
#include <fstream>

PublishHelper::PublishHelper(std::filesystem::path game_folder)
    :_game_folder(std::move(game_folder)) {

    
}

static std::filesystem::path state_file(std::filesystem::path ddl_file) {
    ddl_file.replace_extension(".publish_state");
    return ddl_file;
}

PublishHelper::PublishState PublishHelper::get_state(std::filesystem::path ddl_file) {
    auto sname = state_file(ddl_file);
    std::ifstream f(sname);
    if (!f) return PublishState{{},{},{}, {}, std::move(sname)};    
    Json j = Json::parse([&]() noexcept->std::optional<char> {
        int i = f.get();
        if (i == EOF) return std::nullopt;
        else return static_cast<char>(i);
    });
    std::vector<std::string> tags;
    for (const auto &x: j["tags"].as_array()) tags.push_back(x.as<std::string>());
    auto tm = std::chrono::system_clock::from_time_t(j["publish_time"].as<long>());
    auto id = j["steam_id"].as<std::string>();
    auto vis = j["visibility"].as<unsigned int>();
    return PublishState { std::move(id), tm, std::move(tags),vis, std::move(sname)};
}


std::pair<std::vector<char>, std::string> PublishHelper::get_image(std::filesystem::path ddl_file) {
    auto imgfile = ddl_file;
    imgfile.replace_extension(".image");
    DDLManager manager(imgfile);
    auto data = manager.get("DATA");
    auto ctx = manager.get("CTXT");
    if (!data || !ctx) return {};
    return {
        std::move(data).value(), std::string(ctx->begin(), ctx->end())
    };
}

void PublishHelper::set_image(std::filesystem::path ddl_file, std::span<const char> image, std::string_view content_type) {
    auto imgfile = ddl_file;
    imgfile.replace_extension(".image");
    DDLManager manager(imgfile);
    manager.put("DATA", std::string_view(image.data(), image.size()),0);
    manager.put("CTXT", content_type,0 );
    manager.compact();    
}

void PublishHelper::publish(std::filesystem::path ddl_file, std::string , std::string , std::string,
        std::span<const std::string> tags, unsigned int visibility, std::string ) {

    auto st  = get_state(ddl_file);
    st.publish_time = std::chrono::system_clock::now();
    st.tags.clear();
    st.tags.insert(st.tags.end(), tags.begin(), tags.end());
    st.steam_id = "placeholder";
    st.visibility = visibility;

    
        
    Json jst({
        {"steam_id", st.steam_id},
        {"tags", Json::Array({tags.begin(), tags.end()})},
        {"publish_time",std::chrono::system_clock::to_time_t(st.publish_time)},
        {"visibility", st.visibility}
    });

    std::ofstream f(st.state_file);
    jst.serialize([&](char c){f.put(c);});

}
