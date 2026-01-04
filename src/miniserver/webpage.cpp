
#include <algorithm>
#include <string_view>
#include "webpage_content.hpp"

namespace webarchive {

std::span<const std::string_view> find_file(std::string_view path) {
    const auto &iter = std::find_if(std::begin(webarch_dir),std::end(webarch_dir),[&](const auto &x){
        return x.first == path;
    });
    if (iter == std::end(webarch_dir)) return {};
    return iter->second;
}
}