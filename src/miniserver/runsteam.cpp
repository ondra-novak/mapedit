#include "runsteam.hpp"
#include "utils/process.hpp"
#include <iterator>
#include <string>
#include <system_error>
#include <vector>
#include <filesystem>
#ifdef _WIN32
#include <sstream>
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#else
#include <sys/wait.h>
#include <unistd.h>
#endif

struct ArgList {
    std::vector<char> buffer;
    std::vector<char *> pointers;
};



ArgList to_execve_args(std::span<const std::string> args) {
    ArgList result;
    
    for (const auto& arg : args) {
        std::copy(arg.begin(), arg.end(), std::back_inserter(result.buffer));
        result.buffer.push_back('\0');
    }
    
    for (size_t i = 0, offset = 0; i < args.size(); ++i) {
        result.pointers.push_back(result.buffer.data() + offset);
        offset += args[i].size() + 1;
    }
    result.pointers.push_back(nullptr);
    
    return result;
}

#ifdef WIN32
std::filesystem::path get_steam_path() {
    wchar_t steamPath[MAX_PATH];
    DWORD pathSize = sizeof(steamPath);
    if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", L"SteamExe", 
        RRF_RT_REG_SZ, NULL, steamPath, &pathSize) == ERROR_SUCCESS) {
            return std::filesystem::path(std::wstring(steamPath, pathSize));
    } else {
        throw std::runtime_error("Failed to retrieve Steam path from registry");
    }
}
#else 
std::filesystem::path get_steam_path() {return "steam";}
#endif



Process steam_applaunch(unsigned long long appid, std::span<const std::u8string_view> args) {
    std::string appid_str = std::to_string(appid);
    std::u8string appid_u8str(appid_str.begin(), appid_str.end());
    std::vector<std::u8string_view> allargs;    
    allargs.reserve(args.size()+5);
    allargs.push_back(u8"-applaunch");
    allargs.push_back(appid_u8str);
    for (auto &x: args) allargs.push_back(x);


    return Process(get_steam_path(), allargs);
}