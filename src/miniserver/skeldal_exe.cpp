#include "skeldal_exe.hpp"
#include "utils/fast_copy_file.h"
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


SkeldalExeInstance::~SkeldalExeInstance()
{
    stop();
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


static void start_game(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string addr_port, std::filesystem::path ddlpath, std::atomic<long> *status) {
    

#ifdef _WIN32
    auto exe_path = root_dir / "SKELDAL.EXE";
    std::vector<wchar_t> cmdline;
    std::format_to(std::back_inserter(cmdline), L"{} -f  {} -p {} -c {}", 
        EscapeArgument(exe_path.wstring()), 
        EscapeArgument(cfgpath.wstring()), 
        EscapeArgument(ddlpath.wstring()),
        EscapeArgument(ansiiToUnicode(addr_port)));
    cmdline.push_back(0);

    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi = {};
    

    BOOL success = CreateProcessW(nullptr,cmdline.data(),nullptr,nullptr,FALSE,                                // bInheritHandles
        0,nullptr,root_dir.c_str(),&si,&pi);

    if (success) {
        
        status->store(0);
        status->notify_all();
        WaitForSingleObject(pi.hProcess, INFINITE);

        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        
    } else {
        status->store(static_cast<long>(GetLastError()));
        status->notify_all();
    }
#else

    auto ntf_error = [&]{
        long e = errno;
        if (e == 0) e = EFAULT;
        status->store(e);
        status->notify_all();
    };

    auto exe_path = root_dir / "skeldal.sh";
    PosixArgs args({exe_path.c_str(), "-f", cfgpath.c_str(), "-p", ddlpath.c_str(), "-c", addr_port.c_str()});
    int fds[2];
    if (::pipe2(fds, O_CLOEXEC) != 0) {
        ntf_error();return;
    }   
    pid_t pid = fork();
    if (pid < 0) {
        ntf_error();return;
    }

    if (pid == 0) {//child
        std::filesystem::current_path(root_dir);
        execve(exe_path.c_str(), args, environ);
        long e = errno;
        write(fds[1], &e, sizeof(e));
        _exit(0);    
    } else {    //parent
        close(fds[1]);
        long e = 0;
        int r = read(fds[0], &e, sizeof(e));
        if (r < 0) {
            ntf_error(); return;
        } else if (r > 0) {
            if (e == 0) e = EFAULT;
            status->store(e);
            status->notify_all();
        } else {
            status->store(0);
            status->notify_all();
        }        
        waitpid(pid,  &r, 0);
    }

#endif

}

std::stop_token SkeldalExeInstance::start(std::filesystem::path root_dir, std::filesystem::path cfgpath, std::string port, std::filesystem::path ddlpath)
{
    if (is_running()) {
        return _stop_src.get_token();
    }
    std::atomic<long> status(-1);
    _instance = std::async(start_game, root_dir, cfgpath, port, ddlpath, &status);
    status.wait(-1);
    if (status.load() != 0) {
        _instance.wait();
        throw std::runtime_error(std::format("Failed to start game:  root dir: {} - error: {}", root_dir.string(), status.load() ));
    }
    _stop_src = std::stop_source();
    return _stop_src.get_token();
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
    _curddl_path = ddlpath;    
    auto ddlpath2 = /*SwapAndCopy(_curddl_path);*/ std::move(ddlpath);
    auto token = _instance.start(_root_dir, _cfgpath, _addr_port, ddlpath2);
    _stop_cb.emplace(token, Stopper{this});
}

std::filesystem::path SkeldalExeControl::get_current_ddlpath() const
{
    return _curddl_path;
}

bool SkeldalExeControl::stop() {
    return _instance.stop();
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

bool SkeldalExeInstance::stop()
{
    if (!_instance.valid()) return true;
    _stop_src.request_stop();
    auto status = _instance.wait_for(std::chrono::milliseconds(stop_timeout));
    return (status == std::future_status::ready);
}

bool SkeldalExeInstance::is_running() const
{
    return _instance.valid() && _instance.wait_for(std::chrono::milliseconds(0)) == std::future_status::timeout;
}

SwapAndCopy::SwapAndCopy(std::filesystem::path orig_ddl)
    :_orig_ddl(std::move(orig_ddl))
{
_mapped_ddl = _orig_ddl;
_mapped_ddl.replace_extension(".tmp");
std::filesystem::rename(_orig_ddl, _mapped_ddl);
}

SwapAndCopy::operator const std::filesystem::path &() const
{
    return _mapped_ddl;
}

SwapAndCopy::~SwapAndCopy()
{
    fast_copy_file(_mapped_ddl, _orig_ddl);
}
