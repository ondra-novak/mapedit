#include "steam/isteamugc.h"
#include "steam/steam_api_common.h"
#include "steam/steamtypes.h"
#include "steamservice.hpp"
#include <condition_variable>
#include <optional>
#include <queue>
#include <thread>

template<typename Result, std::invocable<Result *,bool> Callback>
class GenericSteamCall {
public:

    void await(Callback func, SteamAPICall_t call) {
        if (_callback) {
            throw std::runtime_error("Already waiting for a call result");
        }
        _callback.emplace(std::move(func));
        _call_result.Set(call, this, &GenericSteamCall::on_result);        
    }

protected:
    std::optional<Callback> _callback;
    CCallResult<GenericSteamCall,Result> _call_result;

    void on_result(Result *result, bool io_failure) {
        if (_callback) {
            (*_callback)(result, io_failure);
            _callback.reset();
        }
    }
};


class SteamService_Steam: public SteamService::Interface {
public:
    using ErrorCode = SteamService::ErrorCode;
    using QuerySubscribedCallback = SteamService::QuerySubscribedCallback;
    using CreateItemCallback = SteamService::CreateItemCallback;
    using DeleteItemCallback = SteamService::DeleteItemCallback;
    using IItemUpdate = SteamService::IItemUpdate;
    using SubmitItemCallback  = SteamService::SubmitItemCallback;
    using Visibility = SteamService::Visibility;
    using UpdateProgressCallback = SteamService::UpdateProgressCallback;
    using StartItemUpdateCallback = SteamService::StartItemUpdateCallback;

    SteamService_Steam(long appid);
    virtual bool is_available() const override {return _available;}
    virtual ErrorCode error_code() const override {return _error_code;}
    
    virtual bool query_subscribed(QuerySubscribedCallback callback)  override;
    virtual bool create_item( CreateItemCallback callback) override;
    virtual bool delete_item(uint64_t id, DeleteItemCallback callback) override;
    virtual bool start_item_update(uint64_t id, StartItemUpdateCallback callback) override;

protected:
    using QuerySubscribedCall = GenericSteamCall<SteamUGCQueryCompleted_t, std::function<void(SteamUGCQueryCompleted_t *, bool)> >;
    using CreateItemCall = GenericSteamCall<CreateItemResult_t, std::function<void(CreateItemResult_t *, bool)> >;
    using DeleteItemCall = GenericSteamCall<DeleteItemResult_t, std::function<void(DeleteItemResult_t *, bool)> >;
    using SubmitItemCall = GenericSteamCall<SubmitItemUpdateResult_t, std::function<void(SubmitItemUpdateResult_t *, bool)> >;

    class ItemUpdate: public IItemUpdate {
    public:
        ItemUpdate(UGCUpdateHandle_t handle, SteamService_Steam *service);
        virtual bool set_title(const std::string & title) override; 
        virtual bool set_description(const std::string & description) override; 
        virtual bool set_language(const std::string & language) override; 
        virtual bool set_visibility(Visibility visibility) override; 
        virtual bool set_tags(std::span<const std::string> tags) override; 
        virtual bool set_content(std::filesystem::path content_path) override;
        virtual bool set_preview(std::filesystem::path preview_path) override; 
        virtual bool submit(std::string  change_note, SubmitItemCallback callback) override; 
        virtual void get_upload_progress(UpdateProgressCallback cb) override; 
    protected:
        UGCUpdateHandle_t _handle;
        SteamService_Steam *_service;
        SubmitItemCall _call;        
    };

    std::jthread _svcthr;
    bool _available = false;
    ErrorCode _error_code = ErrorCode::OK;
    AppId_t _appid;


    QuerySubscribedCall _query_subscribed_call;
    CreateItemCall _create_item_call;
    DeleteItemCall _delete_item_call;

    std::queue<std::function<void()>> _main_thread_tasks;
    std::mutex _main_thread_tasks_mutex;
    std::condition_variable _main_thread_tasks_cv;

    void post_to_main_thread(std::function<void()> func);
    
private:
    void init_callbacks();
};

