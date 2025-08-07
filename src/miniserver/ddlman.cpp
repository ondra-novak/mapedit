#include "ddlman.hpp"
#include <cstring>
#include <fstream>

constexpr std::string_view directory_mark = "$$DIR$$";

std::vector<DDLManager::Item> DDLManager::list() const
{
    std::vector<DDLManager::Item> out;
    std::ifstream f(_pathname, std::ios::in|std::ios::binary);
    if (!f) return {};
    parse_ddl(f,[&](const DirItemGroup &item){
        auto name = item.get_name();
        if (!name.empty()) {
            out.emplace_back(std::string(name),item.group);
        }
        return true;
    });
    return out;
}

void DDLManager::put(std::string_view name, std::string_view data, uint32_t group) const
{
    if (!std::filesystem::exists(_pathname)) {
        //create empty
        std::fstream tmp(_pathname, std::ios::out|std::ios::binary);
        create_ddl(tmp, 16);
    }
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
            put(name, data, group);
            return ;
        }
    }
    unsigned int index = r->second;
    replace_entry(f, index, name, data, group);    
}

std::optional<std::vector<char>> DDLManager::get(std::string_view name) const
{
    std::optional<std::vector<char>> out;
    std::fstream f(_pathname, std::ios::in|std::ios::binary);
    if (!f) return out;
    auto fnfo = find_file(f, name);
    if (!fnfo) return out;
    out.emplace(get_file(f, fnfo->first));
    return out;
}

void DDLManager::erase(std::string_view name) const
{
    std::fstream f(_pathname, std::ios::in|std::ios::out|std::ios::binary);
    if (!f) return;
    auto fnfo = find_file(f, name);
    if (!fnfo) return;
    replace_entry(f, fnfo->second, {}, {}, 0);
}

void DDLManager::compact() const
{
    std::filesystem::path new_file = _pathname;
    std::filesystem::path bk_file = _pathname;
    new_file += ".new";
    bk_file += ".bak";
    DDLManager newddl(new_file);

    std::vector<DirItemGroup> items;
    std::ifstream sf(_pathname, std::ios::in| std::ios::binary);
    if (!sf) return;

    parse_ddl(sf, [&](const DirItemGroup &it){
        auto n = it.get_name();
        if (!n.empty() && n != directory_mark)  {
            items.push_back(it);
        }
        return true;
    });


    auto tf = newddl.create_ddl(static_cast<unsigned int>(items.size()+16));
    for (unsigned int idx = 0, cnt = static_cast<unsigned int>(items.size()); idx<cnt; ++idx) {
        auto payload = get_file(sf,items[idx]);        
        replace_entry(tf,idx+1,items[idx].get_name(),{payload.data(), payload.size()},items[idx].group);
    }
    sf.close();
    tf.close();
    std::filesystem::rename(_pathname, bk_file);
    std::filesystem::rename(new_file, _pathname);
}

DDLManager::Stats DDLManager::get_stats() const
{
    Stats stats = {};
    std::vector<uint32_t> dir;
    std::ifstream f(_pathname, std::ios::in|std::ios::binary);
    if (!f) return stats;
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
    std::vector<std::pair<uint32_t, uint32_t> > groups;
    f.seekg(0);
    uint32_t def_group;
    uint32_t dir_offset;
    f.read(reinterpret_cast<char *>(&def_group),4);
    f.read(reinterpret_cast<char *>(&dir_offset),4);
    if (!f) throw std::runtime_error("Failed to read header");        
    if (static_cast<uint32_t>(f.tellg()) < dir_offset) {
        groups.push_back({def_group,dir_offset});        
        uint32_t st = dir_offset;
        while (static_cast<uint32_t>(f.tellg()) < st) {
            uint32_t group;
            uint32_t offset;
            f.read(reinterpret_cast<char *>(&group),4);
            f.read(reinterpret_cast<char *>(&offset),4);
            if (!f) throw std::runtime_error("Failed to read group");        
            groups.push_back({group,offset});        
        }
    }

    auto giter = groups.begin();
    auto gend = groups.end();
    auto gnext = giter;
    if (gnext != gend) ++gnext;
    
    // Seek to directory offset
    f.seekg(dir_offset, std::ios::beg);
    if (!f) throw std::runtime_error("Failed to seek to directory offset");

    DirItemGroup first;
    // Read offset of first item (also marks end of directory)
    f.read(reinterpret_cast<char*>(&first), sizeof(DirItem));
    if (!f) throw std::runtime_error("Failed to read end offset");

    std::vector<uint32_t> groups2;

    auto save = f.tellg();
    do {
        uint32_t group = 0;
        if (first.get_name() != directory_mark) {
            if (giter == gend) group = def_group;
            else group = giter->first;
            first.group = group;
            if (!callback(first)) break;
        } else {
            f.seekg(first.offset);
            uint32_t size;
            f.read(reinterpret_cast<char *>(&size), sizeof(size));
            groups2.resize(size/sizeof(uint32_t));
            f.read(reinterpret_cast<char *>(groups2.data()), groups2.size()*4);
        }
        if (gnext != gend && gnext->second <= static_cast<uint32_t>(save)) {
            giter = gnext;
            ++gnext;
            group = giter->first;
        }
        std::size_t idx = 0;
        while (static_cast<uint32_t>(save) < first.offset) {
            DirItemGroup item;
            f.seekg(save);
            f.read(reinterpret_cast<char*>(&item), sizeof(DirItem));
            save = f.tellg();
            if (!f) throw std::runtime_error("Failed to read DirItem");
            item.group = groups2.size() > idx? groups2[idx++]:group;
            if (!callback(item)) break;
            if (gnext != gend && gnext->second <= static_cast<uint32_t>(f.tellg())) {
                giter = gnext;
                ++gnext;
                group = giter->first;
            }
        }    
    } while (false);
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
        std::transform(cropped.begin(), cropped.end(), item.name, [](char c){return static_cast<char>(std::toupper(c));});
        item.offset = offset;
        offset += sitem.size+ 4;
    }
}

std::fstream DDLManager::create_ddl(unsigned int entries) const {
        std::fstream f(_pathname, std::ios::in|std::ios::out|std::ios::trunc|std::ios::binary);    
        if (!f) throw std::runtime_error("Failed to create new version od DDL archive");
        create_ddl(f,entries);
        return f;
}
void DDLManager::create_ddl(std::ostream &f, unsigned int entries) {
    uint32_t z = 0;    
    f.write(reinterpret_cast<const char *>(&z),4);
    z = 8;
    f.write(reinterpret_cast<const char *>(&z),4);
    DirItem first;
    first.set_name(directory_mark);
    first.offset = 8+sizeof(DirItem) * (entries+1);
    DirItem entry = {};
    f.write(reinterpret_cast<const char *>(&first), sizeof(first));
    for (unsigned int i = 0; i < entries; ++i) f.write(reinterpret_cast<const char *>(&entry), sizeof(entry));
    uint32_t sz = entries * 4;
    f.write(reinterpret_cast<const char *>(&sz),sizeof(sz));
    for (unsigned int i = 0; i < entries; ++i) {
        uint32_t grp = 0;
        f.write(reinterpret_cast<const char *>(&grp),sizeof(grp));
    }
    f.flush();
    f.seekp(0);
    f.clear();    

    



}

std::vector<char> DDLManager::get_file(std::istream &f, const DirItem &item)
{
    f.seekg(item.offset);
    if (!f) throw std::runtime_error("Failed to seek to file");
    uint32_t size;
    f.read(reinterpret_cast<char *>(&size),4);
    if (!f || f.gcount() < 4) throw std::runtime_error("Failed to reed file");
    std::vector<char> out;
    if (size) {
        out.resize(size);
        f.read(out.data(), out.size());
        if (!f || static_cast<uint32_t>(f.gcount()) < size) throw std::runtime_error("Failed to reed file");
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

bool DDLManager::exists(std::string_view name) const
{
    std::optional<std::vector<char>> out;
    std::fstream f(_pathname, std::ios::in|std::ios::binary);
    if (!f) return false;
    auto fnfo = find_file(f, name);
    return fnfo.has_value();
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



uint32_t DDLManager::find_free_space(std::iostream &f, std::size_t sz) {

    std::vector<uint32_t> blocks;

    auto dirpos = parse_ddl(f, [&](const DirItem &itm) {    
        blocks.push_back(itm.offset);
        return true;
    });
    blocks.erase(std::remove_if(blocks.begin(), blocks.end(), [&](uint32_t pos){return pos <= dirpos;}), blocks.end());
    std::sort(blocks.begin(), blocks.end());        
    for (size_t i = 1; i < blocks.size(); ++i) {
        auto beg = blocks[i-1];
        auto space = blocks[i]- beg - 4; //4 bytes for size        
        if (space > sz) {
            f.seekg(beg);
            uint32_t bsz = 0;
            f.read(reinterpret_cast<char *>(&bsz),4);
            space -= bsz;
            if (space >= sz) {
                return beg+4+bsz;
            }
        }
    }
    f.seekg(0, std::ios::end);
    return static_cast<uint32_t>(f.tellg());


}

void DDLManager::replace_entry(std::iostream &f, unsigned int index, std::string_view name, std::string_view payload, uint32_t group) 
{
    DirItem entry;
    f.seekg(0, std::ios::end);
    entry.set_name(name);
    entry.offset = payload.empty()?static_cast<uint32_t>(0):static_cast<uint32_t>(f.tellg());

    // Skip first 4 bytes
    f.seekg(4);
    if (!f) throw std::runtime_error("Failed to skip first 4 bytes");

    // Read next 4 bytes as offset (little endian)
    uint32_t dir_offset = 0;
    f.read(reinterpret_cast<char*>(&dir_offset), sizeof(dir_offset));

    f.seekg(dir_offset);
    if (!f) throw std::runtime_error("Failed to read directory offset");

    DirItem first;
    f.read(reinterpret_cast<char *>(&first), sizeof(first));
    if (!f) throw std::runtime_error("Failed to read direcotry");

    bool has_dir_mark = first.get_name() == directory_mark;
    if (has_dir_mark) {
        dir_offset = static_cast<uint32_t>(f.tellg());
    } else {
        f.seekg(dir_offset);
    }

    dir_offset += sizeof(DirItem) * index;

    f.seekp(dir_offset);
    if (!f) throw std::runtime_error("Failed to seek to entry");

    f.write(reinterpret_cast<const char *>(&entry), sizeof(entry));
    if (!f)  throw std::runtime_error("Failed to write to entry");

    if (!payload.empty()) {
        f.seekp(entry.offset);
        if (!f)  throw std::runtime_error("Failed to seek end");
        uint32_t sz = static_cast<uint32_t>(payload.size());
        f.write(reinterpret_cast<const char *>(&sz),4);
        f.write(payload.data(),payload.size());
    }
    if (has_dir_mark && group) {
        f.seekp(first.offset+4+index*4);
        f.write(reinterpret_cast<const char *>(&group), 4);
    }
    f.flush();
    f.seekg(0);
    f.clear();

}

void DDLManager::DirItem::set_name(std::string_view new_name)
{
    std::fill(std::begin(name), std::end(name), '\0');
    auto c = new_name.substr(0, sizeof(name));
    std::copy(c.begin(), c.end(), std::begin(name));
}



