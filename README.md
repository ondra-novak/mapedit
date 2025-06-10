# Skeldal MapEdit

... in development

current development in devel branch

## Goals

- UI in browser 
- local server
- remote control of the game to test maps



## Required tools

### Server

- g++-13 / clang-15
- make
- cmake

### Web 

- nodejs v18
- npm 9.2
- vite/vue (should be installed by npm)

## build

```
$ mkdir build
$ cd build
$ cmake -DCMAKE_BUILD_TYPE=Release ..
$ make all
```

## run

### Debug

- copy mapedit.conf to mapedit.local.conf
- set listen=localhost:8088 
- link SKELDAL.DDL to root directory (or update path in config)
- run server `./build/bin/mapedit_server`
- in another shell go to `src/web`
- run `npm run dev`
- the web page is available on localhost:5173

### Release

- copy `/build/bin` and `/build/web` into separate directory , for example `./release`
- copy `mapedit.conf` to the above directory (`./release`)
- link SKELDAL.DDL to root directory (`./release`)
- run `./release/bin/mapedit_server`

the application should open in new browser's window.