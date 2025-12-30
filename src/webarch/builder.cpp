

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <ranges>
#include <string>
#include <vector>


std::string extract_path(const std::filesystem::path &p) {
    if (p.empty() || !p.has_filename()) return {};
    std::string n = p.filename();
    std::string parent = extract_path(p.parent_path());
    return parent + "/" + n;
}

void process_directory(std::ostream &out, const std::filesystem::path &path, std::vector<std::pair<std::string, std::string> > &mapping) {    
    std::hash<std::string> hasher;
    for (const auto &entry: std::ranges::subrange(std::filesystem::recursive_directory_iterator(path), std::filesystem::recursive_directory_iterator())) {

        const auto &p = entry.path();
        if (entry.is_regular_file()) {
            auto relpath = std::filesystem::relative(p,path);
            std::string web_path = extract_path(relpath);
            std::string data;
            std::ifstream f(p, std::ios::binary);
            std::copy(std::istreambuf_iterator<char>(f), std::istreambuf_iterator<char>(), std::back_inserter(data));
            auto h = hasher(data);
            std::string cname = "file_"+std::to_string(h);
            auto x = std::find_if(mapping.begin(), mapping.end(), [&](const auto &z){
                return z.second == cname;
            });
            if (x == mapping.end()) {
                constexpr std::size_t chunk_size = 1400;
                std::size_t count_chunks = (data.size()+chunk_size-1)/chunk_size;
                out << "constexpr auto " << cname << " =  std::array<std::string_view, " << std::hex << "0x" << count_chunks << "> ({";
                bool qm = false;
                bool avoid_hex = false;
                for (std::size_t i = 0; i < count_chunks; ++i) {
                    auto sub = data.substr(i*chunk_size,chunk_size);
                    std::cout << "std::string_view(";
                    std::cout << "\"";
                    for (char x: sub) {
                        switch (x) {
                            case '\0': std::cout << "\\0";break;
                            case '\n': std::cout << "\\n";break;
                            case '\t': std::cout << "\\t";break;
                            case '\a': std::cout << "\\a";break;
                            case '\b': std::cout << "\\b";break;
                            case '\r': std::cout << "\\r";break;
                            case '\"': std::cout << "\\\"";break;
                            case '\\': std::cout << "\\\\";break;
                            default: if (x > 0 && x < 32) {
                                std::cout << "\\x" << std::hex << static_cast<int>(x);
                                avoid_hex = true;
                            } else {
                                bool qm2 = x == '?';
                                bool is_hex = std::isxdigit(x);
                                if ((qm && qm2)|| (avoid_hex && is_hex)) {
                                    std::cout << "\\x" << std::hex << static_cast<int>(x);
                                    qm = false;
                                    avoid_hex = true;
                                } else {
                                    qm = qm2;
                                    avoid_hex = false;
                                    std::cout.put(x);
                                } 
                                
                            }
                        }
                    }
                    std::cout << "\"," << std::hex << "0x" << sub.size() << "),\n";                    
                }
                out << "});\n";
            }
            mapping.push_back({web_path, cname});
        }
    }
}

int main(int argc, char **argv) {

    if (argc != 2) {
        std::cerr << "Missing arguments :  <path> \n"
            "\n"
            "<path>   path to directory to put into archive\n";

        return 1;
    }
    
    std::filesystem::path path = std::filesystem::canonical(argv[1]);

    std::vector<std::pair<std::string, std::string> > mapping;
    std::cout << "#include <array>\n";
    std::cout << "#include <string_view>\n";
    std::cout << "#include <span>\n";

    process_directory(std::cout, path, mapping);

    std::cout << "constexpr std::pair<std::string_view,std::span<const std::string_view> > webarch_dir[] = {\n";

    for (const auto &m: mapping) {
        std::cout << "{\"" << m.first << "\"," << m.second << "},\n";
    }
    std::cout << "};" << "\n";


}