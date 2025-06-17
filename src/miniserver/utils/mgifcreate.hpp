#pragma once
#include <vector>
#include <cstdint>
#include <string_view>

class MGIFCreator {
public:

    static constexpr unsigned int width = 320;
    static constexpr unsigned int height = 180;

    struct RGB {
        std::uint8_t r,g,b;
    };


    enum Sound {
        nosound,
        mus,
        mp3,
    };

    enum Need : char{
        //nothing, done
        nothing = 'N',
        //need picture
        picture = 'P',
        //need sound
        sound = 'S',

    };

    /// @brief Initialize creator
    /// @param frames count of frames
    /// @param s specifies sound type
    /// @param fps frames per seconds, ignored when nosound
    /// @param freq frequence of sound, ignored when nosound
    void init(unsigned int frames, Sound s = nosound, unsigned int fps = 20, unsigned int freq = 44100);

    Need getNeed() const;

    /// @brief puts sound chunk. It must be whole MP3 frame or any amount samples of for MUS
    /// @param data data
    /// @return count of bytes used, returns 0 if buffer cannot be processed
    std::size_t put_sound_chunk(std::string_view data);
    /// @brief puts indexed image
    /// @param palette 256 entries of palette
    /// @param imgdata image data must be with*height index
    /// @param transp_color image has index 0 as transparent (influences compression)
    /// @retval true processed
    /// @retval not needed now
    bool put_image(const RGB *palette, std::string_view imgdata, bool transp_color);



    /// @brief set compression quality
    /// @param quality 1 - best, 10 - bad
    void set_quality(int quality) {
        _quality = quality;
    }

    const std::vector<std::uint8_t> & get_data() const {
        return _data;
    }

protected:

    struct Lab {
        bool t;
        std::int8_t L;
        std::int8_t a;
        std::int8_t b;
    };

    std::vector<std::uint8_t> _data;
    std::vector<Lab> _color_buffer;        
    std::vector<std::uint8_t> _delta_data;
    std::vector<std::uint8_t> _color_data;
    unsigned int _samples_left = 0; //samples count left in decoder;
    unsigned int _samples_per_frame = 0; //samples per frame;
    unsigned int _prebuffer = 256*1024; //prebuffer sound frames;
    unsigned int _frames; //remainig frames
    int _quality = 9;

    template<typename T>
    requires(std::is_trivially_copyable_v<T>)
    void push_data(const T &data) {
        push_data(std::string_view(reinterpret_cast<const char *>(&data),sizeof(data)));
    }

    void push_data(std::string_view data);
    void create_lzw_copy(bool transp, const std::uint16_t *pal, unsigned int colcount, const uint8_t *pixdata);
    void create_lzw_delta(bool transp, const std::uint16_t *pal, unsigned int colcount, const uint8_t *pixdata);
    void push_chunk(std::uint8_t type, std::uint32_t len);
    static Lab calc_koef(bool transp, std::uint16_t color);
    bool is_same(const Lab &a, const Lab &b) const;
    void push_palette(const std::uint16_t *pal, unsigned int colcount);
};