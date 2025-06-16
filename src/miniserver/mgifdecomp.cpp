#include "mgifdecomp.hpp"

extern "C" {
    #include "utils/mgifmem.h"
}

struct Header {
    int action;
    int csize;
};

template<typename T>
const uint8_t *binary_begin(const T &val) {return reinterpret_cast<const uint8_t *>(&val);}
template<typename T>
const uint8_t *binary_end(const T &val) {return reinterpret_cast<const uint8_t *>(&val)+sizeof(val);}

static void mgif_proc(MGIF_HEADER_T *, int action,const void *data,int csize, void *context) {
     std::vector<uint8_t> *state = reinterpret_cast<std::vector<uint8_t> *>(context);
     Header hdr={action, csize};
    state->insert(state->end(), binary_begin(hdr), binary_end(hdr));
    state->insert(state->end(), reinterpret_cast<const uint8_t *>(data), reinterpret_cast<const uint8_t *>(data)+csize);
}

std::vector<uint8_t> decompress_mgf(const void *data)
{
    std::vector<uint8_t> decomp_stream;
    const void *h = open_mgif(data,&mgif_proc, &decomp_stream);
    if (h == NULL) return {};
    while (mgif_play(h));

    close_mgif(h);
    return decomp_stream;
    

}
