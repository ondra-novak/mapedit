#pragma once
#include <string>
#include <unordered_map>
#include <sstream>
#include <fstream>
#include <algorithm>
#include <filesystem>

class IniFile {
public:
    using Section = std::unordered_map<std::string, std::string>;
    using Data = std::unordered_map<std::string, Section>;

    // Parse from file
    bool load(const std::filesystem::path& filename) {
        std::ifstream file(filename);
        if (!file) return false;
        std::stringstream buffer;
        buffer << file.rdbuf();
        return parse(buffer.str());
    }

    // Parse from string
    bool parse(const std::string& content) {
        data.clear();
        std::istringstream iss(content);
        std::string line, current_section;

        while (std::getline(iss, line)) {
            trim(line);
            if (line.empty() || line[0] == ';' || line[0] == '#')
                continue;
            if (line.front() == '[' && line.back() == ']') {
                current_section = line.substr(1, line.size() - 2);
                trim(current_section);
            } else {
                auto eq = line.find('=');
                if (eq == std::string::npos) continue;
                std::string key = line.substr(0, eq);
                std::string value = line.substr(eq + 1);
                trim(key);
                trim(value);
                data[current_section][key] = value;
            }
        }
        return true;
    }

    // Access data
    const Data& get_data() const { return data; }
    const Section& get_section(const std::string& section) const {
        static Section empty;
        auto it = data.find(section);
        return it != data.end() ? it->second : empty;
    }
    std::string get(const std::string& section, const std::string& key, const std::string& def = "") const {
        auto sit = data.find(section);
        if (sit != data.end()) {
            auto kit = sit->second.find(key);
            if (kit != sit->second.end())
                return kit->second;
        }
        return def;
    }
    // Read a boolean value from the INI file
    bool get_bool(const std::string& section, const std::string& key, bool def = false) const {
        std::string val = get(section, key, "");
        if (val.empty()) return def;
        std::string lower;
        lower.reserve(val.size());
        std::transform(val.begin(), val.end(), std::back_inserter(lower), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
        if (lower == "false" || lower == "no" || lower == "off" || lower == "0")
            return false;
        if (lower == "true" || lower == "yes" || lower == "on" || lower == "1")
            return true;
        // Try to parse as integer
        try {
            return std::stoi(lower) != 0;
        } catch (...) {
            return def;
        }
    }

    int get_int(const std::string& section, const std::string& key, int def = 0) const {
        std::string val = get(section, key, "");
        if (val.empty()) return def;
        try {
            return std::stoi(val);
        } catch (...) {
            return def;
        }
    }

    unsigned int get_uint(const std::string& section, const std::string& key, unsigned int def = 0) const {
        std::string val = get(section, key, "");
        if (val.empty()) return def;
        try {
            size_t idx = 0;
            unsigned long result = std::stoul(val, &idx, 10);
            if (idx != val.size() || result > std::numeric_limits<unsigned int>::max())
                return def;
            return static_cast<unsigned int>(result);
        } catch (...) {
            return def;
        }
    }

    

private:
    Data data;

    static void trim(std::string& s) {
        auto not_space = [](int ch) { return !std::isspace(ch); };
        s.erase(s.begin(), std::find_if(s.begin(), s.end(), not_space));
        s.erase(std::find_if(s.rbegin(), s.rend(), not_space).base(), s.end());
    }
};