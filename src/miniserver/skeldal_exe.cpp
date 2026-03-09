#include "skeldal_exe.hpp"
#include "utils/process.hpp"
#include <chrono>
#include <exception>
#include <initializer_list>
#include <optional>
#include <string>
#include <string_view>
#include <system_error>

#ifdef _WIN32
#include <windows.h>
#else 
#include <unistd.h>
#include <fcntl.h>
#include <wait.h>
extern char **environ;
#endif
#include <cstring>
#include <format>

#ifdef _WIN32
#define SKELDAL_BIN "SKELDAL.EXE"
#else
#define SKELDAL_BIN "skeldal.sh"
#endif


SkeldalExeInstance::~SkeldalExeInstance()
{
    wait_stop(std::chrono::seconds(2));
}

std::wstring EscapeArgument(const std::wstring& arg) {
    if (arg.empty()) return L"\"\"";

    bool needQuotes = arg.find_first_of(L" \t\"") != std::wstring::npos;
    if (!needQuotes) return arg;

    std::wstring result = L"\"";
    for (size_t i = 0; i < arg.size(); ++i) {
        unsigned backslashes = 0;

        // Počet po sobě jdoucích zpětných lomítek
        while (i < arg.size() && arg[i] == L'\\') {
            ++backslashes;
            ++i;
        }

        if (i == arg.size()) {
            // Konec řetězce – escapuj všechny zpětné lomítka
            result.append(backslashes * 2, L'\\');
            break;
        } else if (arg[i] == L'"') {
            // Escapuj zpětná lomítka a samotné "
            result.append(backslashes * 2 + 1, L'\\');
            result += L'"';
        } else {
            // Normální znaky
            result.append(backslashes, L'\\');
            result += arg[i];
        }
    }
    result += L"\"";
    return result;
}


std::wstring ansiiToUnicode(std::string_view str) {
    std::wstring out;
    out.resize(str.size());
    std::copy(str.begin(), str.end(), out.begin());
    return out;
}


class PosixArgs {
public:
    template<int N>
    PosixArgs(const char * const  (&args)[N]):PosixArgs(args, N) {}
    PosixArgs(const char *const  *args, int n) {
        std::size_t needsz = sizeof(char *) * (n+1);
        for (int i = 0; i < n; ++i) needsz += std::strlen(args[i]);
        buffer = static_cast<char **>(malloc(needsz));
        char **ptriter = buffer;
        char *striter = reinterpret_cast<char *>(buffer+n+1);
        for (int i = 0; i < n; ++i) {
            *ptriter++ = striter;
            std::size_t l = std::strlen(args[i])+1;
            std::strncpy(striter, args[i], l);
            striter += l;
        }        
        *ptriter = nullptr;
    }

    operator char * const * () const {return buffer;}

    PosixArgs(const PosixArgs &) =delete;
    PosixArgs &operator=(const PosixArgs &) =delete;
    PosixArgs(PosixArgs &&other):buffer(other.buffer) {other.buffer = nullptr;}
    ~PosixArgs() {free(buffer);}

protected:
    char **buffer;
};



void SkeldalExeInstance::start_publish(std::filesystem::path root_dir, std::filesystem::path packfile) {
    auto packfile_str = packfile.u8string();
    _proc = Process(root_dir/SKELDAL_BIN, {u8"-P", packfile_str});

}

void SkeldalExeInstance::start_preview(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string port, std::filesystem::path ddlpath)
{
    auto u8cfgpath = cfgpath.u8string();
    auto u8ddlpath = ddlpath.u8string();
    auto u8port = std::u8string(port.begin(), port.end());
    _proc = Process(root_dir/SKELDAL_BIN, {u8"-f",u8cfgpath,u8"-p",u8ddlpath,u8"-c",u8port});
}

SkeldalExeControl::SkeldalExeControl(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string addr_port, std::function<void(std::string_view)> command_callback)
    :_root_dir(std::move(root_dir))
    ,_cfgpath(std::move(cfgpath))
    ,_addr_port(std::move(addr_port))
    ,_command_callback(std::move(command_callback))
{

}

void SkeldalExeControl::start(std::filesystem::path ddlpath)
{
    stop();    
    _instance.start_preview(_root_dir, _cfgpath, _addr_port, ddlpath);    
}

std::filesystem::path SkeldalExeControl::get_current_ddlpath() const
{
    return _curddl_path;
}

bool SkeldalExeControl::stop() {
    stop_requested();
    _instance.wait_stop(std::chrono::seconds(2));
}

void SkeldalExeControl::teleport_to(std::string_view map, int sector, int dir , int ghost_form_flag)
{
    _command_callback(std::format("TELEPORT {} {} {} {}", map, sector,dir, ghost_form_flag));
}

void SkeldalExeControl::test_dialog(int id) {
    _command_callback(std::format("TEST_DIALOG {}", id));
}

void SkeldalExeControl::reload_map() {
    _command_callback("RELOAD");
}

void SkeldalExeControl::console_show(bool show) {
    _command_callback(std::format("CONSOLE {}", show?1:0));
}

void SkeldalExeControl::console_exec(std::string_view cmd)
{
    _command_callback(std::format("CONSOLE_CMD {}", cmd));
}

void SkeldalExeControl::stop_requested()
{
    _command_callback("STOP");
}

bool SkeldalExeInstance::wait_stop(std::chrono::steady_clock::duration dur)
{
    if (_proc.joinable()) {
        if (!_proc.join(dur)) {
            _proc.terminate();
            _proc.join();
        }
    }
}

bool SkeldalExeInstance::is_running() const
{
    return _proc.joinable() && !_proc.join(std::chrono::seconds(0));
}

void SkeldalExeControl::publish(std::filesystem::path ddlpath) {
    stop();
    _instance.start_publish(_root_dir, ddlpath);
}