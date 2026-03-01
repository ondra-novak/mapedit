#include "publish_helper.hpp"
#include "ddlman.hpp"
#include "steamservice.hpp"
#include "utils/json.hpp"
#include <chrono>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <future>
#include <stdexcept>
#include <stop_token>
#include <thread>
#include <utility>


static std::filesystem::path state_file_name(std::filesystem::path src) {
    src.replace_extension(".published");
    return src;
}

PublishHelper::PublishHelper(std::filesystem::path ddl_file)
    :_ddl(ddl_file)
    ,_state(state_file_name(ddl_file)) {}

PublishHelper::PublishState PublishHelper::get_state() const {
    auto x = _state.get("metadata");
    PublishState st;
    if (x) {
        Json json = Json::from_string({x->data(),x->size()});
        st.title = json["title"].as_text();
        st.description = json["description"].as_text();
        st.update_lang = json["update_lang"].as_text();
        st.content_lang = json["content_lang"].as_text();
        st.base_lang = json["base_lang"].as_text();
        st.visibility = json["visibility"].as_int();
        st.publish_time = std::chrono::system_clock::from_time_t(json["publish_time"].as<time_t>());
        st.steam_id = json["steam_id"].as<uint64_t>();
        st.tags = json["tags"].as_vector<std::string>();
        auto imgctx = _state.get("imgctx");
        auto img = _state.get("image");
        if (img && imgctx) {
            st.image = std::move(*img);
            st.image_content_type = {imgctx->data(), imgctx->size()};
        }
    }
    return st;
}

void PublishHelper::set_metadata(std::string title,
                      std::string description,
                      std::string update_lang,
                      std::string content_lang,
                      std::string base_lang,
                      std::vector<std::string> tags,
                      unsigned int visibility) {
    PublishState st = get_state();
    st.visibility = visibility;
    st.tags = tags;
    st.update_lang = update_lang;
    st.content_lang = content_lang;
    st.base_lang = base_lang;
    st.title = title;
    st.description = description;
    store_state(st);
}

void PublishHelper::store_state(const PublishState &st) {
    Json state = {
        {"title", st.title},    
        {"description",st.description},
        {"update_lang", st.update_lang},
        {"content_lang", st.content_lang},
        {"base_lang", st.base_lang},
        {"visibility", st.visibility},
        {"publish_time", std::chrono::system_clock::to_time_t(st.publish_time)},
        {"steam_id", st.steam_id},
        {"tags",([&]()->Json{
            Json::Array a;
            a.reserve(st.tags.size());
            for (auto &x: st.tags) a.push_back(x);
            return a;
        })()}
    };
    std::string s = state.to_string();
    _state.put("metadata", s, 0);
}

void PublishHelper::set_image(std::span<const char> image, std::string_view content_type) {
    if (content_type != "image/jpeg" && content_type != "image/png") throw std::runtime_error("Unsupperted image type");
    _state.put("image",{image.data(), image.size()},0);
    _state.put("imgctx", content_type,0);
}



static std::filesystem::path create_preview_image(std::string_view data, std::string_view content_type, const std::filesystem::path &publish_path) {
    auto p = publish_path/"image";
    if (content_type == "image/jpeg") p.replace_extension(".jpg");
    if (content_type == "image/png") p.replace_extension(".png");
    std::ofstream f(p, std::ios::trunc|std::ios::binary);
    if (!f) throw std::runtime_error("Failed to open file for preview image:" + p.string());
    f.write(data.data(), data.length());
    if (!f) throw std::runtime_error("Failed to write file for preview image:" + p.string());
    f.close();
    return p;
    
}

void PublishHelper::create_ini(const std::filesystem::path &target, const PublishState &st) {
    auto p = target/"info.ini";
    std::ofstream f(p, std::ios::trunc);
    if (!f) throw std::runtime_error("Failed to open file for content:" + p.string());
    f << "[description]\n"
         "name=" << st.title  <<"\n"
         "lang=" << st.base_lang << "\n";
    if (!f) throw std::runtime_error("Failed to write file for cotent:" + p.string());
    f.close();

}
PublishHelper::PublishReturn PublishHelper::publish(SteamService *steam, std::string change_desc, 
        std::function<void(bool running, int stage, float percent, int steam_error)> callback) {
    _state.compact();
    auto st = get_state();
    if (st.steam_id == 0) {
        std::promise<std::pair<uint64_t, PublishResult> > idpromise;
        steam->create_item([&](bool success, uint64_t id, bool needLegalAgreement){
            if (!success) idpromise.set_value({0, PublishResult::create_rejected});
            idpromise.set_value({id, needLegalAgreement?PublishResult::need_legal_agr:PublishResult::ok});
        });
        auto cinfo = idpromise.get_future().get();
        if (cinfo.first) {
            st.steam_id = cinfo.first;
            store_state(st);
        }
        if (cinfo.second != PublishResult::ok) return cinfo.second;
    }
    return std::jthread([st = std::move(st), 
                            steam, 
                            content = this->_ddl,
                            change_desc = std::move(change_desc), 
                            callback = std::move(callback)]
        (std::stop_token stp)  {
            try {
                auto update_fld = content;
                update_fld.replace_extension(".update");
                std::filesystem::create_directory(update_fld);
                auto content_fld = update_fld/"content";
                std::filesystem::create_directory(content_fld);

                auto preview_image = create_preview_image({st.image.data(), st.image.size()},st.image_content_type,update_fld);

                DDLManager content_manager(content);
                if (!content_manager.compact_to(content_fld/"content.ddl")) {
                    throw std::runtime_error("Failed to copy content: " + content.string());
                }

                create_ini(content_fld, st);
                auto tags = st.tags;
                if (!st.content_lang.empty()) tags.push_back(st.content_lang);
                
                auto updt = steam->start_item_update(st.steam_id).get();
                updt->set_title(st.title);
                updt->set_description(st.description);
                updt->set_language(st.update_lang);
                updt->set_tags(tags);
                updt->set_visibility((SteamService::Visibility)st.visibility);
                updt->set_preview(preview_image);
                updt->set_content(content_fld);
                
                auto res = std::make_shared<UploadResult>();

                updt->submit(change_desc, [res](bool success, bool needLegalAgreement, int steamErrorCode){
                    res->upload_success = success;
                    res->steam_error = steamErrorCode;
                    res->need_legal_aggr = needLegalAgreement;
                    res->done.store(true);
                });

                while (!stp.stop_requested() && !res->done.load()) {
                    std::this_thread::sleep_for(std::chrono::seconds(1));
                    std::promise<std::tuple<bool, int, uint64_t, uint64_t> > psts;
                    updt->get_upload_progress([&](bool success, int stage, uint64_t bytes_uploaded, uint64_t bytes_total){
                        psts.set_value({success,stage,bytes_uploaded,bytes_total});
                    });
                    auto [succ, stage, pos, total] = psts.get_future().get();
                    if (succ) {
                        callback(true, stage, static_cast<float>(pos)/static_cast<float>(total), 0);
                    }
                }

                std::filesystem::remove_all(update_fld);

                if (res->upload_success) {
                    auto stcp = st;
                    stcp.publish_time = std::chrono::system_clock::now();
                    PublishHelper hlp(content);
                    hlp.store_state(stcp);
                }
                if (res->need_legal_aggr) throw std::runtime_error("Need legal agreement");

                callback(false, res->upload_success, 1, res->upload_success?0:res->steam_error);                
            } catch (...) {
                callback(false, -1, -1, -1);
            }
    });
}



