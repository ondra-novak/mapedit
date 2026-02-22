#pragma once

#include <filesystem>
#include <optional>
#include <span>
#include <string>
#include <vector>
class LangFiles {
public:

    static std::vector<std::string> get_available_languages(std::filesystem::path ddlfile);
    static std::optional<std::vector<char> > get_language_file(std::filesystem::path ddlfile, std::string lang);
    static bool update_lang_file(std::filesystem::path ddlfile, std::string lang, std::span<const char> content);
    static void delete_lang_file(std::filesystem::path ddlfile, std::string lang);

    static std::filesystem::path compose_lang_filename(std::filesystem::path ddlfile, std::string lang);
};