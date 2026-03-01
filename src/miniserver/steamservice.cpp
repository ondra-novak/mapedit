#include "steamservice.hpp"
#include <memory>

#ifdef STEAM_ENABLED 
#include "steamservice_steam.hpp"

SteamService::SteamService(long appid): _ptr(std::make_unique<SteamService_Steam>(appid)) {}


#else

class DummySteamService: public SteamService::Interface {
public:
    virtual bool is_available() const override {return false;}
};

SteamService::SteamService(long appid): _ptr(std::make_unique<DummySteamService>()) {}

#endif

