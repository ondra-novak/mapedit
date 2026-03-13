#include "profile_path.hpp"

#include <cstddef>
#include <filesystem>
#include <cstdlib>  // getenv
#include <fstream>
#include <string>
#include <array>
#include <system_error>
#ifdef _WIN32
#include <windows.h>
#include <shlobj.h>  // SHGetKnownFolderPath
#pragma comment(lib, "shell32.lib")
#endif

namespace fs = std::filesystem;

std::filesystem::path getUserDocumentsPath()
{
#ifdef _WIN32
    PWSTR pathTmp = nullptr;
    HRESULT hr = SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, NULL, &pathTmp);
    if (SUCCEEDED(hr) && pathTmp) {
        fs::path documentsPath = fs::path(pathTmp);
        CoTaskMemFree(pathTmp);
        return documentsPath;
    } else {
        if (pathTmp) CoTaskMemFree(pathTmp);
        // Fallback na USERPROFILE\Documents
        char* userProfile = nullptr;
        size_t len = 0;
        if (_dupenv_s(&userProfile, &len, "USERPROFILE") == 0 && userProfile) {
            fs::path result = fs::path(userProfile) / "AppData" / "Roaming";
            free(userProfile);
            return result;
        } else {
            if (userProfile) free(userProfile);
            return fs::current_path();
        }
    }
#elif __APPLE__
    const char* home = std::getenv("HOME");
    if (home) {
        return fs::path(home) / "Library" / "Application Support";
    } else {
        return fs::current_path();
    }
#else
    const char *home = std::getenv("HOME");
    if (home == NULL) throw std::system_error(errno, std::system_category(),"Current use has no home ($HOME)");
    fs::path hpath(home);
    return hpath / ".local" / "share";
    
#endif
}

#define SAVEGAME_FOLDERNAME "Skeldal"

std::filesystem::path get_default_savegame_dir() {

#ifdef _WIN32
    PWSTR path = nullptr;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_SavedGames, 0, NULL, &path))) {
        std::filesystem::path savedGamesPath(path);
        CoTaskMemFree(path);

        // Převod na UTF-8 std::string
        return (savedGamesPath / SAVEGAME_FOLDERNAME);        
    } else {
        return {};
    }

#else
       char* home = std::getenv("HOME");
       if (home) {
           return std::filesystem::path(home) / ".local/share/" SAVEGAME_FOLDERNAME;
       } else {
           return {};
       }
#endif
}


std::filesystem::path get_importable_adventure_path() {
    auto path = get_default_savegame_dir()/"last_save.nfo";
    if (path.empty()) return path;
    std::ifstream f(path);
    if (!f) return {};
    std::string ddl;
    std::getline(f, ddl);
    path = ddl;
    if (!std::filesystem::is_regular_file(path)) return {};
    return path;
}