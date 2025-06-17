#include "mgifcomp.hpp"
#include <algorithm>
#include <random>

std::string MGifComp::create_mgif(std::string name,int group, int frames,bool transp_color)
{
    auto now =  std::chrono::system_clock::now();
    
    _sessions.erase(std::remove_if(_sessions.begin(), _sessions.end(), [&](const Session &ses){
        return ses.last_activity + std::chrono::minutes(1) < now;
    }), _sessions.end());

    auto creator = std::make_unique<MGIFCreator>();
    creator->init(frames);

    std::string uuid = gen_uuid();
    _sessions.push_back(Session{uuid, name,group,std::move(creator), now, transp_color});
    
    return uuid;
}

struct ImageInfo {
    std::vector<std::uint8_t> index_data;
    MGIFCreator::RGB colors[256];
    unsigned int width;
    unsigned int height;
};



static ImageInfo parse_pcx256(std::string_view pcx_data) {
    // PCX header is 128 bytes
    if (pcx_data.size() < 128)
        throw std::runtime_error("PCX data too short");

    const uint8_t* data = reinterpret_cast<const uint8_t*>(pcx_data.data());

    // Check for 256 color PCX: bits per pixel == 8, color planes == 1
    if (data[3] != 8 || data[65] != 1)
        throw std::runtime_error("Not an 8bpp, 1-plane PCX");

    // Image dimensions
    int xmin = data[4] | (data[5] << 8);
    int ymin = data[6] | (data[7] << 8);
    int xmax = data[8] | (data[9] << 8);
    int ymax = data[10] | (data[11] << 8);
    unsigned int width = xmax - xmin + 1;
    unsigned int height = ymax - ymin + 1;

    // Start of image data
    const uint8_t* img_ptr = data + 128;
    size_t img_len = pcx_data.size() - 128;

    std::vector<std::uint8_t> index_data;
    index_data.reserve(width * height);

    size_t pos = 0;
    while (index_data.size() < width * height && pos < img_len) {
        uint8_t byte = img_ptr[pos++];
        if ((byte & 0xC0) == 0xC0) {
            int count = byte & 0x3F;
            if (pos >= img_len)
                throw std::runtime_error("PCX RLE decode error");
            uint8_t value = img_ptr[pos++];
            for (int i = 0; i < count && index_data.size() < width * height; ++i)
                index_data.push_back(value);
        } else {
            index_data.push_back(byte);
        }
    }

    if (pcx_data.size() < 769)
        throw std::runtime_error("PCX data too short for ImageInfo");
    const uint8_t* pal_ptr = reinterpret_cast<const uint8_t*>(pcx_data.data() + pcx_data.size() - 769);
    if (pal_ptr[0] != 0x0C)
        throw std::runtime_error("PCX ImageInfo marker missing");

    ImageInfo imageInfo;
    for (int i = 0; i < 256; ++i) {
        imageInfo.colors[i].r = pal_ptr[1 + i * 3 + 0];
        imageInfo.colors[i].g = pal_ptr[1 + i * 3 + 1];
        imageInfo.colors[i].b = pal_ptr[1 + i * 3 + 2];
    }

    imageInfo.width = width;
    imageInfo.height = height;
    imageInfo.index_data = std::move(index_data);

    return imageInfo;
}


MGifComp::Status MGifComp::put_image_pcx(std::string session, std::string_view pcx_image)
{
    try {
        ImageInfo nfo = parse_pcx256(pcx_image);
        if (nfo.width != 320 && nfo.height != 180) {
            throw std::runtime_error("Unsupported dimensions: 320x180 required");
        }
        auto iter = std::find_if(_sessions.begin(), _sessions.end(), [&](const Session &n){return n.uuid == session;});
        if (iter == _sessions.end()) throw std::runtime_error("Session not found");
        iter->last_activity = std::chrono::system_clock::now();

        bool r = iter->creator->put_image(nfo.colors, std::string_view(reinterpret_cast<const char *>(nfo.index_data.data()),nfo.index_data.size()), iter->transp_color);
        auto need = iter->creator->getNeed();
        return Status{r,r?"":"Not accepted", need};

    } catch (const std::exception &e) {
        return Status {false, e.what(), MGIFCreator::picture};
    }}

MGifComp::Session MGifComp::close(std::string session)
{
    MGifComp::Session res;
    auto iter = std::find_if(_sessions.begin(), _sessions.end(), [&](const Session &n){return n.uuid == session;});
    if (iter != _sessions.end()) {
        res = std::move(*iter);
        _sessions.erase(iter);        
    }
    return res;
}

std::string MGifComp::gen_uuid()
{
    #include <random>
    #include <sstream>
    #include <iomanip>

    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 15);

    std::stringstream ss;
    for (int i = 0; i < 32; ++i) {
        ss << std::hex << dis(gen);
    }
    return ss.str();
}

