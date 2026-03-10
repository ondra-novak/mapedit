

#include <span>
#include <string>

class Process;

Process steam_applaunch(unsigned long long appid, std::span<const std::u8string_view> params);

