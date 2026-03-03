#include "runsteam.hpp"
#include <iterator>
#include <numeric>
#include <string>
#include <sys/wait.h>
#include <unistd.h>
#include <vector>

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

void steam_applaunch(unsigned long long appid, std::span<const std::string> args) {
    #ifdef _WIN32
        #error not implemented yet
    #else 
    std::string appidstr = std::to_string(appid);    
    std::vector<std::string> finargs = {"steam", "-applaunch"};
    finargs.push_back(appidstr);
    finargs.insert(finargs.end(), args.begin(), args.end());

    auto cargs = to_execve_args(finargs);

    if (fork()) {
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