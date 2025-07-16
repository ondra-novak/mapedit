#include <filesystem>
#include <system_error>
#include <stdexcept>
#include <string>

#ifdef _WIN32
    #include <windows.h>
#else
    #include <fcntl.h>
    #include <unistd.h>
    #include <sys/sendfile.h>
    #include <sys/stat.h>
    #include <errno.h>
#endif

bool fast_copy_file(const std::filesystem::path& from, const std::filesystem::path& to) {
#ifdef _WIN32
    // Use CopyFile2 on Windows 10/11
    COPYFILE2_EXTENDED_PARAMETERS params = { 0 };
    params.dwSize = sizeof(params);
    params.dwCopyFlags = COPY_FILE_NO_BUFFERING;

    HRESULT hr = CopyFile2(from.c_str(), to.c_str(), &params);
    return SUCCEEDED(hr);

#else
    // Try copy_file_range (Linux >= 5.3)
    int src = open(from.c_str(), O_RDONLY);
    if (src < 0) return false;

    int dst = open(to.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0666);
    if (dst < 0) {
        close(src);
        return false;
    }

    off_t offset = 0;
    struct stat stat_buf;

#if defined(__linux__) && defined(__GLIBC__)
    if (fstat(src, &stat_buf) == 0) {
        ssize_t bytes_copied = copy_file_range(src, nullptr, dst, nullptr, stat_buf.st_size, 0);
        if (bytes_copied == stat_buf.st_size) {
            close(src);
            close(dst);
            return true;
        }
    }
#endif

    // Fallback: sendfile
    if (fstat(src, &stat_buf) == 0) {
        ssize_t bytes_sent = sendfile(dst, src, &offset, stat_buf.st_size);
        if (bytes_sent == stat_buf.st_size) {
            close(src);
            close(dst);
            return true;
        }
    }

    // Final fallback: manual copy
    constexpr size_t buffer_size = 8192;
    char buffer[buffer_size];
    ssize_t bytes;
    bool ok = true;

    lseek(src, 0, SEEK_SET);
    lseek(dst, 0, SEEK_SET);

    while ((bytes = read(src, buffer, buffer_size)) > 0) {
        if (write(dst, buffer, bytes) != bytes) {
            ok = false;
            break;
        }
    }

    close(src);
    close(dst);
    return ok;
#endif
}
