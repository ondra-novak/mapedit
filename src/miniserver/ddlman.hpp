#pragma once

#include <filesystem>
#include <vector>
#include <optional>
#include <algorithm>
#include <iostream>
#include <span>
#include <string>
#include <string_view>

/**
 * @brief Manages a simple file-based archive (DDL archive).
 *
 * Provides operations to list, add, retrieve, erase, and compact files
 * within a single archive file.
 */
class DDLManager {
public:
    struct Item {
        std::string name;
        uint32_t group;
    };

    /**
     * @brief Constructs a DDLManager for the specified archive path.
     * @param path Path to the archive file.
     */
    DDLManager(std::filesystem::path path):_pathname(std::move(path)) {}

    /**
     * @brief Lists all file names stored in the archive.
     * @return Vector of file names present in the archive.
     */
    std::vector<Item> list() const;

    /**
     * @brief Inserts or replaces a file in the archive.
     * @param name Name of the file to store.
     * @param data File data to store.
     */
    void put(std::string_view name, std::string_view data, uint32_t group) const;

    /**
     * @brief Retrieves the contents of a file from the archive.
     * @param name Name of the file to retrieve.
     * @return Optional containing file data if found, std::nullopt otherwise.
     */
    std::optional<std::vector<char> > get(std::string_view name) const;

    /**
     * @brief Removes a file from the archive.
     * @param name Name of the file to erase.
     */
    void erase(std::string_view name) const;

    /**
     * @brief Reclaims unused space in the archive by compacting it.
     */
    void compact() const;

    struct Stats {
        std::size_t entries_used = 0;
        std::size_t entries_reserved = 0;
        std::size_t total_space = 0;
        std::size_t used_space = 0;
        std::size_t directory_space = 0;
        std::size_t reserved_space = 0;
    };

    Stats get_stats() const;



protected:
    /// Path to the archive file.
    std::filesystem::path _pathname;

    struct DirItem {
        char name[12];
        uint32_t offset;
        std::string_view get_name() const {
            auto zero_pos = std::find(std::begin(name), std::end(name), '\0');
            return std::string_view(name, zero_pos - std::begin(name));
        }
        void set_name(std::string_view new_name);
    };

    struct DirItemGroup : DirItem{
        uint32_t group;
    };
    
    struct PreparedDirItem {
        std::string_view name;
        uint32_t size;
    };

    template<typename Callback>
    static std::size_t parse_ddl(std::istream &f, Callback &&cb);
    static void build_ddl_directory(std::ostream &f, std::span<const DirItem> list);
    static void build_ddl_directory(std::ostream &f, std::span<const PreparedDirItem> list);
    static void prepare_directory(std::span<const PreparedDirItem> src, std::span<DirItem> list) ;
    static void append_file(std::ostream &f, std::string_view payload) ;
    static void replace_entry(std::iostream &f, unsigned int index, std::string_view name, std::string_view payload, uint32_t group) ;
    std::fstream create_ddl(unsigned int entries) const;
    static void create_ddl(std::ostream &f, unsigned int entries);
    static std::vector<char> get_file(std::istream &f, const DirItem &item);
    static std::optional<std::pair<DirItem, unsigned int> > find_file(std::istream &f, std::string_view name);
    static bool check_empty(std::iostream &f);
};