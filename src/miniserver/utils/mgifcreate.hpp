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

    enum Need {
        picture,
        sound
    };

    /// @brief Initialize creator
    /// @param s specifies sound type
    /// @param fps frames per seconds, ignored when nosound
    /// @param freq frequence of sound, ignored when nosound
    void init(Sound s = nosound, unsigned int fps = 20, unsigned int freq = 44100);

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
    void set_quality(int quality);

protected:
    std::vector<std::uint8_t> _data;
    std::vector<std::uint16_t> _color_buffer;
    unsigned int _samples_left = 0; //samples count left in decoder;
    unsigned int _samples_per_frame = 0; //samples per frame;
    unsigned int _prebuffer = 256*1024; //prebuffer sound frames;
    int _quality = 1;
};