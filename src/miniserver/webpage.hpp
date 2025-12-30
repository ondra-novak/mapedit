#pragma once

#include <span>
#include <string_view>
namespace webarchive {

std::span<const std::string_view> find_file(std::string_view path);

}
