#include "steam/steamclientpublic.h"
#include <cstdint>
#include <memory>
#include <mutex>
#ifdef STEAM_ENABLED
#include "steam/isteamapps.h"
#include "steam/isteamfriends.h"

#include "steam/isteamugc.h"
#include "steam/isteamuser.h"
#include "steamservice.hpp"
#include <format>

#include "steamservice_steam.hpp"
#include <fstream>
#include <future>
#include <steam/steam_api.h>
#include <stop_token>


static void initialize_appid(long appid) {
std::ofstream appidtxt("steam_appid.txt", std::ios::out|std::ios::trunc);
    appidtxt << appid << "\n";    
}

SteamService_Steam::SteamService_Steam(long appid):_appid(appid) {
    initialize_appid(appid);
    std::promise<std::pair<bool, ErrorCode> >  init_res;
    _svcthr = std::jthread([&init_res, this](std::stop_token stoken){        
        bool res = SteamAPI_Init();        
        if (!res) {
            init_res.set_value({false, ErrorCode::NoSteam});
            return;
        }
        if (!SteamUser()->BLoggedOn()) {
            init_res.set_value({false, ErrorCode::NotLoggedIn});
            return;
        }
        if (!SteamApps()->BIsSubscribed()) {
            init_res.set_value({false, ErrorCode::NoLicence});
            return;
        }
        init_res.set_value({true, ErrorCode::OK});

        std::unique_lock lk(this->_main_thread_tasks_mutex);
        while (!stoken.stop_requested()) {
            _main_thread_tasks_cv.wait_for(lk, std::chrono::milliseconds(10));
            if (_main_thread_tasks.empty()) {
                lk.unlock();
                SteamAPI_RunCallbacks();
                lk.lock();
            } else while (!_main_thread_tasks.empty()) {
                auto fn = std::move(_main_thread_tasks.front());
                _main_thread_tasks.pop();
                lk.unlock();
                fn();
                lk.lock();
            }
        }
        SteamAPI_Shutdown();
    });
    auto r = init_res.get_future().get();
    _available = r.first;
    _error_code = r.second;

}

static std::string getCreatorName(uint64 m_ulSteamIDOwner) {
    CSteamID steamID(m_ulSteamIDOwner);
    const char *name = SteamFriends()->GetFriendPersonaName(steamID);
    if (name[0]) {
        return name;
    } else {
        return std::format("#{}", m_ulSteamIDOwner);
    }   
}

bool SteamService_Steam::query_subscribed(QuerySubscribedCallback callback)  {
    if (!_available) {
        return false;
    }
    post_to_main_thread([this,callback = std::move(callback)]() mutable {
        CSteamID steamID = SteamUser()->GetSteamID();
        AccountID_t accountID = steamID.GetAccountID();

        auto handle = SteamUGC()->CreateQueryUserUGCRequest(
            accountID,
            k_EUserUGCList_Subscribed,
            k_EUGCMatchingUGCType_Items, 
            k_EUserUGCListSortOrder_CreationOrderDesc, 
            _appid,
            _appid, 1);    
        _query_subscribed_call.await([callback = std::move(callback)](SteamUGCQueryCompleted_t *result, bool io_failure) {
            if (io_failure) {
                callback({});
            } else {
                std::vector<SteamService::UGCData> ugc_data;
                for (uint32 i = 0; i < result->m_unNumResultsReturned; ++i) {
                    SteamService::UGCData data;
                    SteamUGCDetails_t details;
                    auto res = SteamUGC()->GetQueryUGCResult(result->m_handle, i, &details);
                    if (!res) continue;
                    data.name = details.m_rgchTitle;
                    data.description = details.m_rgchDescription;
                    data.author_name = getCreatorName(details.m_ulSteamIDOwner);
                    data.id = details.m_nPublishedFileId;
                    ugc_data.push_back(data);
                }
                SteamUGC()->ReleaseQueryUGCRequest(result->m_handle);
                callback(ugc_data);
            }
        }, SteamUGC()->SendQueryUGCRequest(handle));
    });
    return true;
}

void SteamService_Steam::post_to_main_thread(std::function<void()> func) {
        std::lock_guard lock(_main_thread_tasks_mutex);
        _main_thread_tasks.push(std::move(func));
        _main_thread_tasks_cv.notify_one();
    }

bool SteamService_Steam::create_item( CreateItemCallback callback) {
    if (!_available) {
        return false;
    }
    post_to_main_thread([this, callback = std::move(callback)]() mutable {
        _create_item_call.await([callback = std::move(callback)](CreateItemResult_t *result, bool io_failure) {
            if (io_failure) {
                callback(false, 0, false);
            } else {
                callback(result->m_eResult == k_EResultOK, result->m_nPublishedFileId, result->m_bUserNeedsToAcceptWorkshopLegalAgreement);
            }
        }, SteamUGC()->CreateItem(_appid, k_EWorkshopFileTypeCommunity));
    });
    return true;
}

bool SteamService_Steam::delete_item(uint64_t id, DeleteItemCallback callback) {
    if (!_available) {
        return false;
    }
    post_to_main_thread([this, id, callback = std::move(callback)]() mutable {
        _delete_item_call.await([callback = std::move(callback)](DeleteItemResult_t *result, bool io_failure) {
            if (io_failure) {
                callback(false, 0);
            } else {
                callback(result->m_eResult == k_EResultOK, result->m_nPublishedFileId);
            }
        }, SteamUGC()->DeleteItem(id));
    });
    return true;
}       


SteamService_Steam::ItemUpdate::ItemUpdate(UGCUpdateHandle_t handle, SteamService_Steam *service)
    :_handle(handle), _service(service) {

}

bool SteamService_Steam::ItemUpdate::set_title(const std::string &title){
    return SteamUGC()->SetItemTitle(_handle, title.c_str());

}
bool SteamService_Steam::ItemUpdate::set_description(const std::string &description){
    return SteamUGC()->SetItemDescription(_handle, description.c_str());
}
bool SteamService_Steam::ItemUpdate::set_language(const std::string &language){
    return SteamUGC()->SetItemUpdateLanguage(_handle, language.c_str());
}
bool SteamService_Steam::ItemUpdate::set_visibility(Visibility visibility){
    return SteamUGC()->SetItemVisibility(_handle, (ERemoteStoragePublishedFileVisibility) visibility);
}
bool SteamService_Steam::ItemUpdate::set_tags(std::span<const std::string> tags) {

    std::vector<const char *> list;
    list.reserve(tags.size());
    for (const auto &x: tags) list.push_back(x.c_str());

    SteamParamStringArray_t ptags{list.data(), static_cast<int32_t>(list.size())};

    return SteamUGC()->SetItemTags(_handle, &ptags);

}
bool SteamService_Steam::ItemUpdate::set_content(std::filesystem::path content_path){
    return SteamUGC()->SetItemContent(_handle, content_path.string().c_str());
}
bool SteamService_Steam::ItemUpdate::set_preview(std::filesystem::path preview_path){
    return SteamUGC()->SetItemPreview(_handle, preview_path.string().c_str());
}
bool SteamService_Steam::ItemUpdate::submit(std::string change_note, SubmitItemCallback callback){
    
    _service->post_to_main_thread([this, callback=std::move(callback), change_note = std::move(change_note)]() mutable {
        _call.await([this, callback = std::move(callback)](SubmitItemUpdateResult_t *result, bool io_failure){

            if (io_failure) {
                callback(false, false, -1);                
            } else {
                callback(result->m_eResult == k_EResultOK , result->m_bUserNeedsToAcceptWorkshopLegalAgreement, result->m_eResult);
            }
        },SteamUGC()->SubmitItemUpdate(_handle, change_note.empty()?NULL:change_note.c_str()));
    });
    return true;
}
void SteamService_Steam::ItemUpdate::get_upload_progress(UpdateProgressCallback cb) {
    _service->post_to_main_thread([handle = this->_handle,callback = std::move(cb)] {
        uint64 processed = 0;
        uint64 total = 0;
        auto st = SteamUGC()->GetItemUpdateProgress(handle, &processed, &total);
        callback(st == k_EItemUpdateStatusInvalid, st, processed, total);
    });

}

bool SteamService_Steam::start_item_update(uint64_t id, StartItemUpdateCallback callback) {
    post_to_main_thread([this, id, callback = std::move(callback)]{
        auto handle = SteamUGC()->StartItemUpdate(_appid, id);
        auto ptr = std::make_unique<ItemUpdate>(handle, this);
        callback(std::move(ptr));
    });
    return true;
}



#endif