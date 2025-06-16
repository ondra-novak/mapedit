#include "mgifcreate.hpp"
#include <stdexcept>

extern "C" {
    #include "mgifmem.h"
}

constexpr auto header_magic = std::string_view("MGIF97?");

void MGIFCreator::init(Sound s, unsigned int fps, unsigned int freq) {
    _samples_per_frame = freq*2/fps;
    if (s != nosound) throw std::runtime_error("Not implemented");

    _data.clear();
    _color_buffer.clear();
    std::copy(header_magic.begin(), header_magic.end(), std::back_inserter(_data));
    


}
