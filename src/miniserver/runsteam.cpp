#include "runsteam.hpp"
#include <iterator>
#include <numeric>
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
std::wstring get_steam_path() {
    wchar_t steamPath[MAX_PATH];
    DWORD pathSize = sizeof(steamPath);
    if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\Valve\\Steam", L"SteamExe", 
        RRF_RT_REG_SZ, NULL, steamPath, &pathSize) == ERROR_SUCCESS) {
        return std::wstring(steamPath);
    } else {
        throw std::runtime_error("Failed to retrieve Steam path from registry");
    }
}

#endif

void steam_applaunch(unsigned long long appid, std::span<const std::string> args) {
    #ifdef _WIN32
        
        std::wostringstream argbld;
        std::wstring steampath = get_steam_path();
        argbld << L'"' << steampath << L'"' << L" -applaunch " << appid;
        std::wstring tmp;
        for (auto &z: args) {
            auto sp = z.find(' ');            
            auto need = MultiByteToWideChar(CP_UTF8, 0, z.data(),static_cast<int>(z.size()),0,0);
            tmp.resize(need);
            MultiByteToWideChar(CP_UTF8, 0, z.data(),static_cast<int>(z.size()),tmp.data(),static_cast<int>(tmp.size()));
            argbld << " ";
            if (sp == z.npos) argbld << tmp; else argbld << '"' << tmp << '"';
        }
        auto str_args = std::move(argbld).str();
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi;
        if (!CreateProcessW(nullptr, str_args.data(), nullptr, nullptr, FALSE, 0, nullptr, nullptr, &si, &pi)) {
            throw std::system_error(GetLastError(), std::system_category(), "CreateProcessW failed");
        }
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);   


    #else 
    std::string appidstr = std::to_string(appid);    
    std::vector<std::string> finargs = {"steam", "-applaunch"};
    finargs.push_back(appidstr);
    finargs.insert(finargs.end(), args.begin(), args.end());

    auto cargs = to_execve_args(finargs);

    int fr =  fork();
    if (fr < 0) throw std::system_error(errno, std::system_category(), "fork failed");
    if (!fr) {
        setsid();
        execvp(cargs.pointers[0],cargs.pointers.data());
    }   

    #endif
}

void skeldal_direct_publish(std::filesystem::path root_dir, std::filesystem::path pakfile) {
    #ifdef _WIN32
        
        std::wostringstream argbld;
        std::wstring path = (root_dir/"SKELDAL.EXE").wstring();
        argbld << L'"' << path << L'"' << L" -P \"" << pakfile << L"\"";

        auto str_args = std::move(argbld).str();
        STARTUPINFOW si = { sizeof(si) };
        PROCESS_INFORMATION pi;
        if (!CreateProcessW(nullptr, str_args.data(), nullptr, nullptr, FALSE, 0, nullptr, nullptr, &si, &pi)) {
            throw std::system_error(GetLastError(), std::system_category(), "CreateProcessW failed");
        }
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);   


    #else 
    std::string path = (root_dir/"skeldal_bin").string();
    std::vector<std::string> finargs = {path, "-P", pakfile.string()};
    finargs.push_back(appidstr);
    finargs.insert(finargs.end(), args.begin(), args.end());

    auto cargs = to_execve_args(finargs);

    int fr =  fork();
    if (fr < 0) throw std::system_error(errno, std::system_category(), "fork failed");
    if (!fr) {
        setsid();
        execvp(cargs.pointers[0],cargs.pointers.data());
    }   

    #endif
}

void zombie_reaper() {
    #ifndef _WIN32
        int st;
        waitpid(0,&st,WNOHANG);
    #endif
}