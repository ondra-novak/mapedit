#include "profile_path.hpp"

#include <cstddef>
#include <filesystem>
#include <cstdlib>  // getenv
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