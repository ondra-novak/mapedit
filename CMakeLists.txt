cmake_minimum_required(VERSION 3.20)
project(mapedit)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(WIN32)
    set(CMDPREFIX cmd.exe /C)
else()
    set(CMDPREFIX "")
endif()



set(STEAMWORKS_SDK_DIR "" CACHE PATH "Path to Steamworks SDK directory")

if(NOT STEAMWORKS_SDK_DIR)
    set(POSSIBLE_STEAMWORKS_DIR "${CMAKE_SOURCE_DIR}/external/steamworks")
    if(EXISTS "${POSSIBLE_STEAMWORKS_DIR}/public")
        if(NOT EXISTS "${STEAMWORKS_SDK_DIR}/redistributable_bin") 
            set(STEAMWORKS_SDK_DIR "${POSSIBLE_STEAMWORKS_DIR}" CACHE PATH "Path to Steamworks SDK directory" FORCE)
        endif()
    endif()    
    if (NOT STEAMWORKS_SDK_DIR)
         message("!!! Steam is not installed")
         message("!!! compiling without steam and without publish support")
         message("!!! To enable steam, set STEAMWORKS_SDK_DIR to correct value")
         set(STEAMWORKS_SDK_DIR "none" CACHE PATH "Path to Steamworks SDK directory" FORCE) 
    endif()
endif()

if(${STEAMWORKS_SDK_DIR} STREQUAL "none")
    set(STEAM_ENABLED 0)
else()
    add_compile_definitions(STEAM_ENABLED)
    include_directories(${STEAMWORKS_SDK_DIR}/public)
    set(STEAM_ENABLED 1)

endif()


set(VERSION_IN "${CMAKE_SOURCE_DIR}/src/version.in.h")
set(VERSION_OUT "${CMAKE_BINARY_DIR}/version.h")

find_package(Git QUIET)

if(GIT_FOUND)
    execute_process(
        COMMAND ${GIT_EXECUTABLE} describe --tags --always
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        OUTPUT_VARIABLE GIT_VERSION
        OUTPUT_STRIP_TRAILING_WHITESPACE
        RESULT_VARIABLE GIT_RESULT
    )
    if(NOT GIT_RESULT EQUAL 0)
        set(GIT_VERSION "unknown")
    endif()
else()
    set(GIT_VERSION "unknown")
endif()

set(APP_VERSION "${GIT_VERSION}")
configure_file(${VERSION_IN} ${VERSION_OUT} @ONLY)

include_directories(${CMAKE_BINARY_DIR})


set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

set(STEAMLIB "")


if(MSVC)
    add_compile_options(/W4 /permissive- /D_CRT_SECURE_NO_WARNINGS)
    if (STEAM_ENABLED)
         if(CMAKE_SIZEOF_VOID_P EQUAL 8)
            # 64-bit
            set(STEAMLIB ${STEAMWORKS_SDK_DIR}/redistributable_bin/win64/steam_api64.lib)
        else()
            # 32-bit
            set(STEAMLIB ${STEAMWORKS_SDK_DIR}/redistributable_bin/win32/steam_api.lib)
        endif()
    endif()
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
     if(CMAKE_SIZEOF_VOID_P EQUAL 8)
            # 64-bit
            set(STEAMLIB ${STEAMWORKS_SDK_DIR}/redistributable_bin/linux64/libsteam_api.so)
        else()
            # 32-bit
            set(STEAMLIB ${STEAMWORKS_SDK_DIR}/redistributable_bin/linux32/libsteam_api.so)
        endif()
endif()

include_directories(AFTER ${CMAKE_BINARY_DIR})

add_subdirectory(src/miniserver)
add_subdirectory(src/webarch)
add_subdirectory(src/web)