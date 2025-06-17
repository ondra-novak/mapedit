#include "mgifcreate.hpp"
#include <stdexcept>
#include "lzw.h"
#include <cmath>

extern "C" {
    #include "mgifmem.h"
}

#define MGIF_EMPTY  0
#define MGIF_LZW    1
#define MGIF_DELTA  2
#define MGIF_PAL    3
#define MGIF_SOUND  4
#define MGIF_TEXT   5
#define MGIF_COPY   6
#define MGIF_SINIT  7

constexpr auto header_magic = std::string_view("MGIF97\x1A");

struct AmplTable {
    std::int16_t table[256];
};
struct Reserved32 {
    std::uint16_t res[32];
};

void MGIFCreator::init(unsigned int frames, Sound s, unsigned int fps, unsigned int freq) {
    _samples_per_frame = freq*2/fps;
    if (s != nosound) throw std::runtime_error("Not implemented");

    _data.clear();
    _color_buffer.clear();
    push_data(header_magic);
    push_data<std::uint16_t>(0x100);
    push_data<std::int32_t>(frames);
    push_data<std::uint16_t>(2);
    push_data<std::int32_t>(freq);

    AmplTable ampl_table;;
    for(int a=0;a<128;a++) {
        int b=(a/128.0);
        b=(b*b*b*b*32768.0);
        int c= std::max(b, a);
        ampl_table.table[128+a] = c;
        ampl_table.table[128-a] = -c;
     }
    push_data(ampl_table);
    Reserved32 res= {};
    push_data(res);
    _frames = frames;
}

MGIFCreator::Need MGIFCreator::getNeed() const
{
    if (_frames>0) return picture;
    return nothing;
}

std::size_t MGIFCreator::put_sound_chunk(std::string_view )
{
    return 0;
}

bool MGIFCreator::put_image(const RGB *palette, std::string_view imgdata, bool transp_color)
{
    RGB reduced[256];
    int col_use[256];
    int nx = 1;

    if (imgdata.size() != width*height) return false;

    std::fill(std::begin(col_use), std::end(col_use), -1);
    
    reduced[0] = palette[0];
    col_use[0] = 0;

    uint8_t pixdata[width*height];
    for (char b: imgdata) {
        uint8_t c = static_cast<uint8_t>(b);
        int new_idx = col_use[c];
        if (new_idx == -1) {
            new_idx = col_use[c] = nx;
            reduced[nx] = palette[c];
            ++nx;
        }
    }
    std::uint16_t palette16[256];
    for (int i = 0; i < nx; ++i) {
        const RGB &c = reduced[i];
        palette16[i] = static_cast<uint16_t>(
            ((c.r & 0xF8) << 7) | ((c.g & 0xF8) << 2) | ((c.b & 0xF8) >> 3)
        );
    }
    
    if (_color_buffer.empty()) {
        create_lzw_copy(transp_color,palette16, nx, pixdata);
    } else {
        create_lzw_delta(transp_color,palette16, nx, pixdata);
    }
    --_frames;

    return true;


}

void MGIFCreator::push_data(std::string_view data)
{
    _data.insert(_data.end(), data.begin(), data.end());
}

void MGIFCreator::push_chunk(std::uint8_t type, std::uint32_t len) {
    push_data(type);
    push_data<std::uint8_t>(len & 0xFF);
    push_data<std::uint8_t>((len >> 8) & 0xFF);
    push_data<std::uint8_t>((len >> 16) & 0xFF);
}

struct HdrTracker {
    int chunks = 0;
    int size = 0;

    void add_chunk(int size) {this->chunks++; this->size += size+4;}
};

void MGIFCreator::create_lzw_copy(bool transp, const std::uint16_t *pal, unsigned int colcount, const uint8_t *pixdata)
{
    HdrTracker trk;
    trk.add_chunk(colcount*2);
    constexpr long total_sz = width*height;
    char outbuff[2*total_sz];
    _color_buffer.resize(total_sz);
    for (std::size_t i = 0; i < total_sz; ++i) {
        _color_buffer[i] =  calc_koef(transp && (pixdata[i] == 0), pal[pixdata[i]]);
    }
    LZW_t lzw;
    long sz = lzw.encode(pixdata, total_sz, outbuff);
    if (sz>total_sz) {
        trk.add_chunk(total_sz);
    } else {
        trk.add_chunk(sz);
    }
    push_chunk(trk.chunks, trk.size);
    push_palette(pal, colcount);
    if (sz > total_sz) {
        push_chunk(MGIF_COPY, total_sz);
        push_data(std::string_view(reinterpret_cast<const char *>(pixdata), total_sz));
    } else {
        push_chunk(MGIF_LZW, sz);
        push_data(std::string_view(reinterpret_cast<const char *>(outbuff), sz));
    }

}


// Pomocné funkce pro převod
static double pivot_rgb(double n) {
    return (n > 0.04045) ? std::pow((n + 0.055) / 1.055, 2.4) : (n / 12.92);
}

static double pivot_xyz(double n) {
    return (n > 0.008856) ? std::pow(n, 1.0/3.0) : (7.787 * n + 16.0 / 116.0);
}

static // Převod RGB na Lab
void rgb_to_lab(int R, int G, int B, double *L, double *a, double *b) {
    // 1. Normalize RGB
    double r = pivot_rgb(R / 255.0);
    double g = pivot_rgb(G / 255.0);
    double b_ = pivot_rgb(B / 255.0);

    // 2. RGB to XYZ
    double X = r * 0.4124 + g * 0.3576 + b_ * 0.1805;
    double Y = r * 0.2126 + g * 0.7152 + b_ * 0.0722;
    double Z = r * 0.0193 + g * 0.1192 + b_ * 0.9505;

    // 3. Normalize for D65 white point
    X /= 0.95047;
    Y /= 1.00000;
    Z /= 1.08883;

    // 4. XYZ to Lab
    double fx = pivot_xyz(X);
    double fy = pivot_xyz(Y);
    double fz = pivot_xyz(Z);

    *L = 116.0 * fy - 16.0;
    *a = 500.0 * (fx - fy);
    *b = 200.0 * (fy - fz);
}

MGIFCreator::Lab MGIFCreator::calc_koef(bool transp, std::uint16_t color) {
    int R = ((color >> 7) & 0xF8) | ((color >> 12) & 0x7);
    int G = ((color >> 2) & 0xF8) | ((color >> 7) & 0x7);
    int B = ((color << 3) & 0xF8) | ((color >> 3) & 0x7);

    double L;
    double a;
    double b;
    rgb_to_lab(R,G,B, &L, &a, &b);

    return {transp, static_cast<std::int8_t>(L), static_cast<std::int8_t>(a), static_cast<std::int8_t>(b)};
}

bool MGIFCreator::is_same(const Lab &a, const Lab &b) const {
    if (a.t || b.t) return a.t == b.t;
    int q2 = _quality * _quality;
    int dL = a.L - b.L;
    int da = a.a - b.a;
    int db = a.b - b.b;
    return q2 <= (dL*dL + da*da + db*db);
}

void MGIFCreator::push_palette(const std::uint16_t *pal, unsigned int colcount) {
    push_chunk(MGIF_PAL, colcount*2);
    for (unsigned int i = 0; i < colcount; ++i) {
        push_data(pal[i]);
    }
}

void MGIFCreator::create_lzw_delta(bool transp, const std::uint16_t *pal, unsigned int colcount, const uint8_t *pixdata)
{
    HdrTracker trk;
    trk.add_chunk(colcount*2);
    _delta_data.clear();
    _color_data.clear();
    _delta_data.resize(3);
    _delta_data.push_back(0xFF);
    for (unsigned int y = 0; y < height; ++y) {
        auto ofsy = y * width;
        auto dofs = _delta_data.size();
        unsigned int skip_cols = 0;
        bool skipm = true;
        for (unsigned int x = 0; x< width; x+=2) {
            auto ofsx = ofsy + x;
            std::uint8_t idx = pixdata[ofsx];
            std::uint8_t idx2 = pixdata[ofsx+1];
            Lab &l1 = _color_buffer[ofsx];
            Lab &l2 = _color_buffer[ofsx+1];
            Lab l3 = calc_koef(transp && (idx == 0), pal[idx]);
            Lab l4 = calc_koef(transp && (idx2 == 0), pal[idx2]);
            bool sm = is_same(l1,l3) && is_same(l2,l4);
            if (!sm) {
                l1 = l3;
                l2 = l4;
            }
            if (sm == skipm) {
                ++skip_cols;
            } else {
                _delta_data.push_back(static_cast<std::uint8_t>(skip_cols));
                skip_cols = 0;             
                skipm = !skipm;
            }
        }
        if (_delta_data.size() == dofs ) {
            auto b = _delta_data.back();
            if (b < 0xFF) {
                _delta_data.pop_back();
                ++b;
                _delta_data.push_back(b);
            }
            else {
                _delta_data.push_back(0xC0);
            }
        } else {
            bool d= false;
            int start = 0;
            while (dofs < _delta_data.size()) {
                int n = _delta_data[dofs];
                n *= 2;
                if (d) {       
                    int end = n+start;
                    for (int i = start; i < end; ++i) {
                        _color_data.push_back(pixdata[ofsy+i]);
                    }
                    start = end;
                
                } else {
                    start += n;                     
                }
                d = !d;
                ++dofs;
            }
            _delta_data.push_back(0xC0);
        }
    }
    std::uint32_t n = _delta_data.size() - 4;
    _delta_data[0] = n & 0xFF;
    _delta_data[1] = (n>>8) & 0xFF;
    _delta_data[2] = (n>>16) & 0xFF;
    _delta_data[3] = (n>>24) & 0xFF;
    _delta_data.insert(_delta_data.end(), _color_data.begin(), _color_data.end());
    _color_data.clear();
    _color_data.resize(_delta_data.size() *2);
    LZW_t lzw;
    long len = lzw.encode(_delta_data.data(),_delta_data.size(), _color_data.data());
    trk.add_chunk(len);;
    push_chunk(trk.chunks, trk.size);
    push_palette(pal, colcount);
    push_chunk(MGIF_DELTA, len);
    push_data(std::string_view(reinterpret_cast<const char *>(_color_data.data()), len));

}
