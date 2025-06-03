#include "ddlman.hpp"
#include <cstring>
#include <fstream>

std::vector<std::string> DDLManager::list() const
{
    std::vector<std::string> out;
    std::ifstream f(_pathname, std::ios::in|std::ios::binary);
    if (!f) return {};
    parse_ddl(f,[&](const DirItem &item){
        auto name = item.get_name();
        if (!name.empty()) {
            out.emplace_back(name);
        }
        return true;
    });
    return out;
}

void DDLManager::put(std::string_view name, std::string_view data) const
{
    std::fstream f(_pathname, std::ios::in|std::ios::out|std::ios::binary);
    if (!f) throw std::runtime_error("Can't open DDL file");
    

    if (check_empty(f)) {
        create_ddl(f, 16);
    }

    auto r = find_file(f, name);
    if (!r) {
        r = find_file(f, {});
        if (!r) {
            f.close();
            compact();
            put(name, data);
            return ;
        }
    }
    unsigned int index = r->second;
    replace_entry(f, index, name, data);    
}

std::optional<std::vector<char>> DDLManager::get(std::string_view name) const
{
    std::optional<std::vector<char>> out;
    std::fstream f(_pathname, std::ios::in|std::ios::binary);
    if (!f) return out;
    auto fnfo = find_file(f, name);
    out.emplace(get_file(f, fnfo->first));
    return out;
}

void DDLManager::erase(std::string_view name) const
{
    std::fstream f(_pathname, std::ios::in|std::ios::binary);
    if (!f) return;
    auto fnfo = find_file(f, name);
    if (!fnfo) return;
    replace_entry(f, fnfo->second, {}, {});
}

void DDLManager::compact() const
{
    std::filesystem::path new_file = _pathname;
    std::filesystem::path bk_file = _pathname;
    new_file += ".new";
    bk_file += ".bak";
    DDLManager newddl(new_file);

    std::vector<DirItem> items;
    std::ifstream sf(_pathname, std::ios::in| std::ios::binary);
    if (!sf) return;

    parse_ddl(sf, [&](const DirItem &it){
        if (!it.get_name().empty())  {
            items.push_back(it);
        }
        return true;
    });


    auto tf = newddl.create_ddl(items.size()+16);
    for (unsigned int idx = 0, cnt = static_cast<unsigned int>(items.size()); idx<cnt; ++idx) {
        auto payload = get_file(sf,items[idx]);        
        replace_entry(tf,idx,items[idx].get_name(),{payload.data(), payload.size()});
    }
    sf.close();
    tf.close();
    std::filesystem::rename(_pathname, bk_file);
    std::filesystem::rename(new_file, _pathname);
}

DDLManager::Stats DDLManager::get_stats() const
{
    Stats stats;
    std::vector<uint32_t> dir;
    std::ifstream f(_pathname, std::ios::in|std::ios::binary);
    stats.reserved_space = parse_ddl(f, [&](const DirItem &item) {
        if (item.get_name().empty()) ++stats.entries_reserved;
        else {
            ++stats.entries_used;
            dir.push_back(item.offset);
        }
        return true;
    });
    for (uint32_t ofs: dir) {
        uint32_t sz = 0;
        f.seekg(ofs);
        f.read(reinterpret_cast<char *>(&sz),4);
        stats.used_space += sz+4;
    }
    f.seekg(0,std::ios::end);
    stats.total_space = f.tellg();
    stats.directory_space = dir.size() * sizeof(DirItem);
    return stats;

}

template<typename Callback>
std::size_t DDLManager::parse_ddl(std::istream &f, Callback &&callback) 
{
    // Skip first 4 bytes
    f.seekg(4, std::ios::beg);
    if (!f) throw std::runtime_error("Failed to skip first 4 bytes");

    // Read next 4 bytes as offset (little endian)
    uint32_t dir_offset = 0;
    f.read(reinterpret_cast<char*>(&dir_offset), sizeof(dir_offset));
    if (!f) throw std::runtime_error("Failed to read directory offset");

    // Seek to directory offset
    f.seekg(dir_offset, std::ios::beg);
    if (!f) throw std::runtime_error("Failed to seek to directory offset");

    DirItem first;
    // Read offset of first item (also marks end of directory)
    f.read(reinterpret_cast<char*>(&first), sizeof(DirItem));
    if (!f) throw std::runtime_error("Failed to read end offset");

    while (static_cast<uint32_t>(f.tellg()) < first.offset) {
        DirItem item;
        f.read(reinterpret_cast<char*>(&item), sizeof(DirItem));
        if (!f) throw std::runtime_error("Failed to read DirItem");
        if (!callback(item)) break;
    }    
    return dir_offset;
}

void DDLManager::build_ddl_directory(std::ostream &f, std::span<const DirItem> list) 
{
    uint32_t zero = 0;
    uint32_t dir_offset = 8;

    // Write fixed header: 4 bytes zero, 4 bytes offset (8)
    f.write(reinterpret_cast<const char*>(&zero), sizeof(zero));
    f.write(reinterpret_cast<const char*>(&dir_offset), sizeof(dir_offset));

    // Write directory items in binary form
    for (const auto& item : list) {
        f.write(reinterpret_cast<const char*>(&item), sizeof(DirItem));
    }
}

void DDLManager::prepare_directory(std::span<const PreparedDirItem> src, std::span<DirItem> list) 
{
    if (list.size() < src.size()) {
        throw std::runtime_error("Destination list is too small");
    }

    // Calculate initial offset: header (8 bytes) + all DirItems
    uint32_t offset = 8 + static_cast<uint32_t>(sizeof(DirItem) * src.size());

    std::size_t idx = 0;
    for(const PreparedDirItem &sitem: src) {
        DirItem &item = list[idx++];
        auto cropped = sitem.name.substr(0,12);
        std::transform(cropped.begin(), cropped.end(), item.name, [](char c){return std::toupper(c);});
        item.offset = offset;
        offset += sitem.size+ 4;
    }
}

std::fstream DDLManager::create_ddl(unsigned int entries) const {
    
    std::fstream f(_pathname, std::ios::out|std::ios::trunc|std::ios::binary);
    if (!f) throw std::runtime_error("Failed to create new version od DDL archive");
    create_ddl(f,entries);
    return f;
}
void DDLManager::create_ddl(std::ostream &f, unsigned int entries) {
    uint32_t z = 0;
    f.write(reinterpret_cast<const char *>(&z),4);
    z = 8;
    f.write(reinterpret_cast<const char *>(&z),4);
    DirItem entry = {};
    entry.offset = 8+sizeof(DirItem) * entries;
    for (unsigned int i = 0; i < entries; ++i) f.write(reinterpret_cast<const char *>(&entry), sizeof(entry));
    
    



}

std::vector<char> DDLManager::get_file(std::istream &f, const DirItem &item)
{
    f.seekg(item.offset);
    if (!f) throw std::runtime_error("Failed to seek to file");
    uint32_t size;
    f.read(reinterpret_cast<char *>(&size),4);
    if (!f || f.gcount() == 4) throw std::runtime_error("Failed to reed file");
    std::vector<char> out;
    if (size) {
        out.resize(size);
        f.read(out.data(), out.size());
        if (!f || static_cast<uint32_t>(f.gcount()) == size) throw std::runtime_error("Failed to reed file");
    }
    return out;

}

std::optional<std::pair<DDLManager::DirItem, unsigned int> > DDLManager::find_file(std::istream &f, std::string_view name)
{ 
    DirItem search;
    search.set_name(name);   
    auto n1 = search.get_name();
    std::optional<std::pair<DirItem, unsigned int>  > out;
    unsigned int index = 0;
    parse_ddl(f, [&](const DirItem &item) {
        auto n2 = item.get_name();
        if (n2 != n1) {
            ++index;
            return true;
        }
        out.emplace(item,index);
        ++index;
        return false;
    });
    return out;
}

bool DDLManager::check_empty(std::iostream &f)
{
    f.seekg(0, std::ios::end);
    return f.tellg() == 0;
}

void DDLManager::build_ddl_directory(std::ostream &f, std::span<const PreparedDirItem> list)  { 
    std::vector<DirItem> items(list.size());
    prepare_directory(list, items);
    build_ddl_directory(f, items);
}

void DDLManager::append_file(std::ostream &f, std::string_view payload) 
{
    f.seekp(0, std::ios::end);
    uint32_t size = static_cast<uint32_t>(payload.size());
    f.write(reinterpret_cast<const char*>(&size), sizeof(size));
    f.write(payload.data(), payload.size());
}

void DDLManager::replace_entry(std::iostream &f, unsigned int index, std::string_view name, std::string_view payload) 
{
    DirItem entry;
    f.seekg(0, std::ios::end);
    entry.set_name(name);
    entry.offset = payload.empty()?static_cast<uint32_t>(0):static_cast<uint32_t>(f.tellg());

    // Skip first 4 bytes
    f.seekg(4, std::ios::beg);
    if (!f) throw std::runtime_error("Failed to skip first 4 bytes");

    // Read next 4 bytes as offset (little endian)
    uint32_t dir_offset = 0;
    f.read(reinterpret_cast<char*>(&dir_offset), sizeof(dir_offset));
    
    if (!f) throw std::runtime_error("Failed to read directory offset");
    dir_offset += sizeof(DirItem) * index;

    f.seekp(dir_offset);
    if (!f) throw std::runtime_error("Failed to seek to entry");

    f.write(reinterpret_cast<const char *>(&entry), sizeof(entry));
    if (!f)  throw std::runtime_error("Failed to write to entry");

    if (!payload.empty()) {
        f.seekp(entry.offset);
        if (!f)  throw std::runtime_error("Failed to seek end");

        f.write(payload.data(),payload.size());
    }
}

void DDLManager::DirItem::set_name(std::string_view new_name)
{
    auto c = new_name.substr(0, sizeof(name));
    auto iter = std::copy(c.begin(), c.end(), std::begin(name));
    if (iter != std::end(name)) *iter = 0;    
}



