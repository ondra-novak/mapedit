//!!!! POZOR, NUTNE LINKOVAT SOUBOR LZWA.ASM
#ifndef _MGIFMEM_H



#define _MGIFMEM_H
#define MGIF "MGIF"
#define MGIF_Y "97"
#define VER 0x100
#define MGIF_EMPTY  0
#define MGIF_LZW    1
#define MGIF_DELTA  2
#define MGIF_PAL    3
#define MGIF_SOUND  4
#define MGIF_TEXT   5
#define MGIF_COPY   6
#define MGIF_SINIT  7

#define SMD_256 1
#define SMD_HICOLOR 2

typedef struct mgf_play_state MGF_PLAY_STATE;


typedef struct mgif_header
    {
    char sign[4];
    char year[2];
    char eof;
    uint16_t ver;
    int32_t frames;
    uint16_t snd_chans;
    int32_t snd_freq;
    short ampl_table[256];
    const void *nx_frame;
    int32_t cur_frame;
    short accnums[2];
    int32_t sound_write_pos;
    MGF_PLAY_STATE *state;
    }MGIF_HEADER_T;

    typedef void (*MGIF_PROC)(MGIF_HEADER_T *hdr, int,const void *,int csize, void *ctx); //prvni cislo akce, druhy data akce



void mgif_install_proc(const void *mgif, MGIF_PROC proc, void *ctx);
const void *open_mgif(const void *mgif); //vraci ukazatel na prvni frame
char mgif_play(const void *mgif); //dekoduje a zobrazi frame
void close_mgif(const void *mgif);           //dealokuje buffery pro prehravani
#endif
