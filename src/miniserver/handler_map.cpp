#include "handler_map.hpp"
#include "utils/http_utils.hpp"
#include <vector>

namespace server {

std::string urldecode(std::string_view text)
{
    std::string result;
    result.reserve(text.size());
    for (size_t i = 0; i < text.size(); ++i) {
        if (text[i] == '%') {
            if (i + 2 < text.size()) {
                char hex[3] = { text[i + 1], text[i + 2], 0 };
                result += static_cast<char>(std::strtol(hex, nullptr, 16));
                i += 2;
            }
        } else if (text[i] == '+') {
            result += ' ';
        } else {
            result += text[i];
        }
    }
    return result;
}

bool match_path(std::string_view source_path, std::string_view pattern, PathVariableList &path_vars, VariableList &query_vars) {
    size_t query_pos = source_path.find('?');
    std::string_view path_part = source_path.substr(0, query_pos);
    std::string_view query_part = (query_pos != std::string_view::npos) ? source_path.substr(query_pos + 1) : std::string_view{};

    path_vars.clear();


    do {
        auto patpart = utils::split_at(pattern, "/");
        if (patpart == "{*}") {
            path_vars.emplace_back(urldecode(path_part));
            pattern = {};
            path_part = {};
            break;
        }

        auto pthpart = utils::split_at(path_part, "/");
        if (patpart == "{}" && path_part.empty() == pattern.empty()) {
            path_vars.emplace_back(urldecode(pthpart));
        } else if (patpart != pthpart) {
            return false;
        }
    } while (!pattern.empty() && !path_part.empty());
    if (pattern =="{}") {
        path_vars.emplace_back("");
    } else if (path_part.empty() != pattern.empty()) {
        return false;
    }

    while (!query_part.empty()) {
        auto kv =utils::split_at(query_part, "&");
        auto k = utils::trim(utils::split_at(kv, "="));
        auto v = utils::trim(kv);
        query_vars.emplace_back(urldecode(k), urldecode(v));
    }

    return true;
}

}