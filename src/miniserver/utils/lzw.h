
typedef struct lzwstate_t LZWSTATE_T;


#ifdef __cplusplus 
    extern "C" {
#endif
LZWSTATE_T *lzw_init(char incremental);
void lzw_done(LZWSTATE_T *st);
long lzw_encode(LZWSTATE_T *st, const unsigned char *source,void *target,int size);
void lzw_decode(LZWSTATE_T *st, const void *source,unsigned char *target);

#ifdef __cplusplus 
    }

#include <memory>

class LZW_t {
public:
    LZW_t(bool incremental):_ptr(lzw_init(incremental?1:0)) {}
    long encode(const unsigned char *data, int data_size, void *target) {
        return lzw_encode(_ptr.get(),data, target, data_size);
    }
    void decode(const void *source, unsigned char *target) {
        return lzw_decode(_ptr.get(), source, target);
    }

protected:
    struct Deleter {void operator()(LZWSTATE_T *st){lzw_done(st);}};
    std::unique_ptr<LZWSTATE_T, Deleter> _ptr;

    

};

#endif

