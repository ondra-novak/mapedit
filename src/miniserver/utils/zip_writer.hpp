#pragma once

#include <array>
#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

///Collects files and emits an uncompressed (STORE) ZIP archive.
class ZipWriter {
public:

    void add_file(std::string_view name, std::string_view data) {
        uint32_t crc = crc32(data);
        uint32_t sz = static_cast<uint32_t>(data.size());
        uint32_t offset = static_cast<uint32_t>(_out.size());
        _entries.push_back({std::string(name), crc, sz, offset});
        write_local_header(name, crc, sz);
        append(data);
    }

    std::vector<char> finish() {
        uint32_t cd_offset = static_cast<uint32_t>(_out.size());
        for (const auto &e : _entries)
            write_central_header(e);
        uint32_t cd_size = static_cast<uint32_t>(_out.size()) - cd_offset;
        write_eocd(static_cast<uint16_t>(_entries.size()), cd_size, cd_offset);
        return std::move(_out);
    }

private:

    struct Entry {
        std::string name;
        uint32_t crc;
        uint32_t size;
        uint32_t offset;
    };

    std::vector<char> _out;
    std::vector<Entry> _entries;

    static constexpr std::array<uint32_t, 256> make_crc_table() {
        std::array<uint32_t, 256> table = {};
        for (uint32_t i = 0; i < 256; ++i) {
            uint32_t c = i;
            for (int j = 0; j < 8; ++j)
                c = (c & 1) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1);
            table[i] = c;
        }
        return table;
    }

    static uint32_t crc32(std::string_view data) {
        static constexpr auto table = make_crc_table();
        uint32_t crc = 0xFFFFFFFF;
        for (unsigned char c : data)
            crc = (crc >> 8) ^ table[(crc ^ c) & 0xFF];
        return crc ^ 0xFFFFFFFF;
    }

    void append(std::string_view data) {
        _out.insert(_out.end(), data.begin(), data.end());
    }

    void write_u16(uint16_t v) {
        _out.push_back(static_cast<char>(v & 0xFF));
        _out.push_back(static_cast<char>((v >> 8) & 0xFF));
    }

    void write_u32(uint32_t v) {
        _out.push_back(static_cast<char>(v & 0xFF));
        _out.push_back(static_cast<char>((v >> 8) & 0xFF));
        _out.push_back(static_cast<char>((v >> 16) & 0xFF));
        _out.push_back(static_cast<char>((v >> 24) & 0xFF));
    }

    void write_local_header(std::string_view name, uint32_t crc, uint32_t size) {
        write_u32(0x04034b50u); // PK\x03\x04
        write_u16(20);          // version needed: 2.0
        write_u16(0);           // flags
        write_u16(0);           // compression: STORE
        write_u16(0);           // mod time
        write_u16(0);           // mod date
        write_u32(crc);
        write_u32(size);
        write_u32(size);        // compressed == uncompressed for STORE
        write_u16(static_cast<uint16_t>(name.size()));
        write_u16(0);           // extra field length
        append(name);
    }

    void write_central_header(const Entry &e) {
        write_u32(0x02014b50u); // PK\x01\x02
        write_u16(20);          // version made by
        write_u16(20);          // version needed
        write_u16(0);           // flags
        write_u16(0);           // compression: STORE
        write_u16(0);           // mod time
        write_u16(0);           // mod date
        write_u32(e.crc);
        write_u32(e.size);
        write_u32(e.size);
        write_u16(static_cast<uint16_t>(e.name.size()));
        write_u16(0);           // extra field length
        write_u16(0);           // file comment length
        write_u16(0);           // disk number start
        write_u16(0);           // internal file attributes
        write_u32(0);           // external file attributes
        write_u32(e.offset);
        append(e.name);
    }

    void write_eocd(uint16_t count, uint32_t cd_size, uint32_t cd_offset) {
        write_u32(0x06054b50u); // PK\x05\x06
        write_u16(0);           // disk number
        write_u16(0);           // disk with start of central dir
        write_u16(count);
        write_u16(count);
        write_u32(cd_size);
        write_u32(cd_offset);
        write_u16(0);           // comment length
    }
};
