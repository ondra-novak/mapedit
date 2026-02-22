#include "langfiles.hpp"
#include <filesystem>
#include <format>
#include <fstream>
#include <iterator>
#include <ranges>
#include <system_error>

std::vector<std::string> LangFiles::get_available_languages(std::filesystem::path ddlfile){
    std::vector<std::string> out;
    auto path = ddlfile.parent_path();
    auto name = ddlfile.stem().string();
    for (const auto &entry: std::ranges::subrange(std::filesystem::directory_iterator(path),std::filesystem::directory_iterator())) {
        if (entry.is_regular_file()) {
            const auto &p = entry.path();
            if (p.has_extension() && p.extension().string() == ".lang") {
                auto stem = p.stem().string();
                if (stem.length() > name.length() && stem.compare(0,name.length(),name) == 0 && stem[name.length()] == '.') {
                    out.push_back(stem.substr(name.length()+1));
                }
            }
        }
    }
    return out;
}

std::filesystem::path LangFiles::compose_lang_filename(std::filesystem::path ddlfile, std::string lang) {
    auto name =std::format("{}.{}.lang",ddlfile.stem().string(),lang);
    return ddlfile.parent_path()/name;
    
}
std::optional<std::vector<char> > LangFiles::get_language_file(std::filesystem::path ddlfile, std::string lang){
    auto lfn = compose_lang_filename(ddlfile, lang);
    std::optional<std::vector<char> > out;
    std::ifstream in(lfn, std::ios::binary);
    if (!!in) {
        out.emplace();
        std::copy(std::istreambuf_iterator<char>(in),std::istreambuf_iterator<char>(), std::back_inserter(*out));
    }
    return out;
}
bool LangFiles::update_lang_file(std::filesystem::path ddlfile, std::string lang, std::span<const char> content){
    auto lfn = compose_lang_filename(ddlfile, lang);
    std::ofstream out(lfn, std::ios::binary|std::ios::trunc);
    if (!out) return false;
    out.write(content.data(), content.size());
    return true;
}
void LangFiles::delete_lang_file(std::filesystem::path ddlfile, std::string lang){
    auto lfn = compose_lang_filename(ddlfile, lang);
    std::error_code ec;
    std::filesystem::remove(lfn,ec);
}
