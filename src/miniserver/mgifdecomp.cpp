#include "mgifdecomp.hpp"

extern "C" {
    #include "utils/mgifmem.h"
}



static void mgif_proc(MGIF_HEADER_T *, int action,const void *data,int csize, void *context) {
     std::vector<uint8_t> *state = reinterpret_cast<std::vector<uint8_t> *>(context);

}

std::vector<uint8_t> decompress_mgf(const void *data, size_t size)
{
    std::vector<uint8_t> frames;
    const void *h = open_mgif(data);
    

    mgif_install_proc(h,&mgif_proc, &frames);

    while (mgif_play(h));

    close_mgif(h);

    

}
