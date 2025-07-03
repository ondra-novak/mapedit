#include "profile_path.hpp"

#include <filesystem>
#include <cstdlib>  // getenv
#include <string>
#include <array>
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
    HRESULT hr = SHGetKnownFolderPath(FOLDERID_Documents, 0, NULL, &pathTmp);
    if (SUCCEEDED(hr) && pathTmp) {
        fs::path documentsPath = fs::path(pathTmp);
        CoTaskMemFree(pathTmp);
        return documentsPath;
    } else {
        if (pathTmp) CoTaskMemFree(pathTmp);
        // Fallback na USERPROFILE\Documents
        const char* userProfile = std::getenv("USERPROFILE");
        if (userProfile) {
            return fs::path(userProfile) / "Documents";
        } else {
            return fs::current_path();
        }
    }
#elif __APPLE__
    const char* home = std::getenv("HOME");
    if (home) {
        return fs::path(home) / "Documents";
    } else {
        return fs::current_path();
    }
#else
     // Pokus o získání cesty k Dokumentům pomocí xdg-user-dir
    std::string command = "xdg-user-dir DOCUMENTS";
    std::array<char, 128> buffer;
    std::string result;
    
    // Otevření procesu pro čtení výstupu příkazu
    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe) {
        // Pokud se příkaz nepovede spustit, vrátíme domovskou složku
        return fs::path(std::getenv("HOME"));
    }
    
    // Čtení výstupu příkazu
    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
        result += buffer.data();
    }
    
    // Uzavření procesu
    int status = pclose(pipe);
    if (status == -1) {
        return fs::path(std::getenv("HOME"));
    }
    
    // Odstranění koncového znaku nového řádku
    if (!result.empty() && result.back() == '\n') {
        result.pop_back();
    }
    
    // Kontrola, zda je výstup platnou cestou
    if (result.empty() || !fs::exists(result)) {
        return fs::path(std::getenv("HOME"));
    }
    
    return fs::path(result);
    
#endif
}