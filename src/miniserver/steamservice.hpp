#pragma once

#include <cstdint>
#include <filesystem>
#include <functional>
#include <future>
#include <memory>
#include <optional>
#include <span>
class SteamService {
public:

   enum class ErrorCode {
        OK,
        NoSteam,
        NotLoggedIn,
        NoLicence
    };

    struct UGCData {
        std::string name;
        std::string description;
        std::string author_name;
        uint64_t id;
    };

    enum class Visibility {
        Public = 0,
        FriendsOnly = 1,
        Private = 2,
        Unlisted = 3,
    };




    using QuerySubscribedCallback = std::function<void(std::span<const UGCData>)>;
    using CreateItemCallback = std::function<void(bool success, uint64_t id, bool needLegalAgreement)>;
    using DeleteItemCallback = std::function<void(bool success, uint64_t id)>;
    using SubmitItemCallback = std::function<void(bool success, bool needLegalAgreement, int steamErrorCode)>;
    using UpdateProgressCallback = std::function<void(bool success, int stage, uint64_t bytes_uploaded, uint64_t bytes_total)>;



    class IItemUpdate {
    public:
        virtual ~IItemUpdate()=default; 
        virtual bool set_title(const std::string & title) = 0;
        virtual bool set_description(const std::string & description) = 0;
        virtual bool set_language(const std::string & language) = 0;
        virtual bool set_visibility(Visibility visibility) = 0;
        virtual bool set_tags(std::span<const std::string> tags) = 0;
        virtual bool set_content(std::filesystem::path content_path) = 0;    
        virtual bool set_preview(std::filesystem::path preview_path) = 0;
        virtual bool submit(std::string change_note,  SubmitItemCallback cb) = 0;
        virtual void get_upload_progress(UpdateProgressCallback cb) = 0;
    };

    using StartItemUpdateCallback = std::function<void(std::unique_ptr<IItemUpdate> ptr)>;


    class Interface {
    public:
        virtual ~Interface()=default;
        
        ///steam interface is available
        virtual bool is_available() const = 0;
        ///Returns last error code
        virtual ErrorCode error_code() const = 0;
        ///query list of subscribed items, result is returned via callback, returns false if query could not be sent (e.g. not logged in)
        virtual bool query_subscribed(QuerySubscribedCallback callback)  = 0;
        virtual bool create_item(CreateItemCallback callback) = 0;
        virtual bool delete_item(uint64_t id, DeleteItemCallback callback) = 0;        
        virtual bool start_item_update(uint64_t id, StartItemUpdateCallback callback) = 0;        
    };


    SteamService(long appid);
    ///steam interface is available
    bool is_available() const {return _ptr->is_available();}
    ///Returns last error code
    ErrorCode error_code() const {return _ptr->error_code();}
    ///query list of subscribed items, result is returned via callback, returns false if query could not be sent (e.g. not logged in)
    bool query_subscribed(QuerySubscribedCallback callback) const {
        return _ptr->query_subscribed(std::move(callback));
    }
    bool create_item(CreateItemCallback callback) const {
        return _ptr->create_item(std::move(callback));
    }
    bool delete_item(uint64_t id, DeleteItemCallback callback) const {
        return _ptr->delete_item(id, std::move(callback));
    }
    bool start_item_update(uint64_t id, StartItemUpdateCallback cb) {
        return _ptr->start_item_update(id, std::move(cb));
    }
    std::future<std::unique_ptr<IItemUpdate> > start_item_update(uint64_t id) {
        auto prom = std::make_shared<std::promise<std::unique_ptr<IItemUpdate> > >();
        auto fut = prom->get_future();
        if (!_ptr->start_item_update(id, [prom](std::unique_ptr<IItemUpdate>ptr){
            prom->set_value(std::move(ptr));
        })) {
            prom->set_value(nullptr);
        }
        return fut;
    }

protected:
    std::unique_ptr<Interface> _ptr;


};