#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include "lzw.h"


#define LZW_MAX_CODES  4096

typedef struct double_s
  {
  short group,chr,first,next;
  }DOUBLE_S;

typedef DOUBLE_S CODE_TABLE[LZW_MAX_CODES];


typedef struct lzwstate_t
{
   DOUBLE_S *compress_dic;
   int clear_code;
   int end_code;
   int free_code;
   int nextgroup;
   int bitsize;
   int init_bitsize;
   char incremental;
   unsigned char old_value;   
} LZWSTATE_T;




static void do_clear_code(LZWSTATE_T *st) //funkce maze slovni (clear code)
  {
  int i;

  st->old_value=0;
  st->nextgroup=st->free_code;
  st->bitsize=st->init_bitsize;
  for(i=0;i<st->clear_code;i++)
     {
     DOUBLE_S *p;
     p=&st->compress_dic[i];
     p->group=i;p->chr=-1;p->next=-1;p->first=-1;
     }
  }

void reinit_lzw(LZWSTATE_T *st)
  {
  do_clear_code(st);
  }

LZWSTATE_T *lzw_init(char incremental)
  {
   LZWSTATE_T *st = (LZWSTATE_T *)malloc(sizeof(LZWSTATE_T));
   memset(st, 0, sizeof(LZWSTATE_T));
   st->compress_dic=(DOUBLE_S *)malloc(sizeof(CODE_TABLE));
   memset(st->compress_dic, 0, sizeof(CODE_TABLE));
   st->clear_code=1<<8;
   st->end_code=st->clear_code+1;
   st->free_code=st->end_code+1;
   st->nextgroup=st->free_code;
   st->incremental = incremental;
   st->init_bitsize=st->bitsize=8+1;
   do_clear_code(st);
   return st;
  }


void lzw_done(LZWSTATE_T *st)
  {
  free(st->compress_dic);
  free(st);
  }

unsigned char incremental_encode(LZWSTATE_T *st, unsigned char srcbyte) {
   if (st->incremental) {
      unsigned char res = srcbyte - st->old_value;
      st->old_value = srcbyte;
      srcbyte = res;
   }
   return srcbyte;
}

unsigned char incremental_decode(LZWSTATE_T *st, unsigned char srcbyte) {
   if (st->incremental) {
      srcbyte = st->old_value + srcbyte;
   }
   return srcbyte;
}

static long output_code_c(void *target,long bitepos,int bitesize,int data)
  {
  unsigned char *c;
  c=(unsigned char *)target;
  c+=bitepos>>3;
  data<<=bitepos & 7;
  c[0]|=data;
  c[1]=data>>8;
  c[2]=data>>16;
  return bitepos+bitesize;
  }


static int input_code_c(const unsigned char *source,long *bitepos,int bitsize,int mask)
 {
  const unsigned char *c;int x;
  c=source;
  c+=*bitepos>>3;
  x=c[0]+(c[1]<<8)+(c[2]<<16);
  x>>=*bitepos & 7;
  x &= mask;
  *bitepos=*bitepos+bitsize;
  return x;
 }


static int find_code(LZWSTATE_T *st, DOUBLE_S *p)
  //hleda skupinu ve slovniku. Pokud neexistuje vraci -1;
  {
  int ps;

  ps=p->group;
  ps=st->compress_dic[ps].first;
  while (ps!=-1)
     {
     if (st->compress_dic[ps].chr==p->chr) return ps;
     ps=st->compress_dic[ps].next;
     }
  return -1;
  }


static void add_code(LZWSTATE_T *st, DOUBLE_S *p)
  //vklada novou dvojici
  {
  p->first=-1;p->next=st->compress_dic[p->group].first;
  memcpy(&st->compress_dic[st->nextgroup],p,sizeof(DOUBLE_S));
  st->compress_dic[p->group].first=st->nextgroup;
  st->nextgroup++;
  }


long lzw_encode(LZWSTATE_T *st, const unsigned char *source,void *target,int size)
  //Encode LZW. zdroj, cil a velikost dat. Vraci velikost komprimovano.
  {
  long bitpos=0;
  DOUBLE_S p;
  int f;

  clear:
  p.group = incremental_encode(st, *source);
  size--;
  while (size-->0)
     {
     p.chr=incremental_encode(st,*source++);
     f=find_code(st, &p);
     if (f<0)
        {
        bitpos=output_code_c(target,bitpos,st->bitsize,p.group);
        add_code(st, &p);
        if (st->nextgroup==(1<<st->bitsize)) st->bitsize++;
        p.group=p.chr;
        if (st->nextgroup>=LZW_MAX_CODES)
           {
           bitpos=output_code_c(target,bitpos,st->bitsize,p.group);
           bitpos=output_code_c(target,bitpos,st->bitsize,st->clear_code);
           do_clear_code(st);
           goto clear;
           }
        }
     else
        p.group=f;
     }
  bitpos=output_code_c(target,bitpos,st->bitsize,p.group);
  bitpos=output_code_c(target,bitpos,st->bitsize,st->end_code);
  return (bitpos+8)>>3;
  }


static void de_add_code(LZWSTATE_T *st, DOUBLE_S *p,int *mask)
  {
  DOUBLE_S *q;

  q=&st->compress_dic[st->nextgroup];q->group=p->group;q->chr=p->chr;q->first=st->compress_dic[p->group].first+1;
  st->nextgroup++;
  if (st->nextgroup==*mask)
     {
     *mask=(*mask<<1)+1;
     st->bitsize++;
     }
  }



static int expand_code(LZWSTATE_T *st, int code,unsigned char **target)
  {
  static int first;

  if (code>st->end_code)
     {
     assert(st->compress_dic[code].group<code);
     expand_code(st, st->compress_dic[code].group,target);
     **target=st->old_value=st->compress_dic[code].chr;
     (*target)++;
     }
  else
     {
     **target=st->old_value=code;
     (*target)++;
     first=code;
     }
  return first;
  }
/*
char fast_expand_code(int code,char **target);
#pragma aux fast_expand_code parm[eax][edi] modify [esi ecx] value [bl]
*/

void lzw_decode(LZWSTATE_T *st, const void *source,unsigned char *target)
  //dekomprimuje lzw. Nevraci velikost, tu si musi program zajistit sam.
  {
  long bitpos=0;
  int code,old,i;
  DOUBLE_S p;
  int old_first;
  int mask=0xff;


  for(i=0;i<LZW_MAX_CODES;i++) st->compress_dic[i].first=0;
  clear:
  st->old_value=0;
  st->nextgroup=st->free_code;
  st->bitsize=st->init_bitsize;
  mask=(1<<st->bitsize)-1;
  code=input_code_c(source,&bitpos,st->bitsize,mask);
  old_first=expand_code(st,code,&target);
  old=code;
  while ((code=input_code_c(source,&bitpos,st->bitsize,mask))!=st->end_code)
     {
     if (code==st->clear_code)
        {
        goto clear;
        }
     else if (code<st->nextgroup)
        {
        old_first=expand_code(st,code,&target);
        p.group=old;
        p.chr=old_first;
        de_add_code(st,&p,&mask);
        old=code;
        }
     else
        {
        p.group=old;
        p.chr=old_first;
        de_add_code(st,&p,&mask);
        old_first=expand_code(st,code,&target);
        old=code;
        }
     }
    }

