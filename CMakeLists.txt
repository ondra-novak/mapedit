cmake_minimum_required(VERSION 3.20)
project(mapedit)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(WIN32)
    set(CMDPREFIX cmd.exe /C)
else()
    set(CMDPREFIX "")
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


if(MSVC)
    add_compile_options(/W4 /permissive- /D_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

include_directories(AFTER ${CMAKE_BINARY_DIR})

add_subdirectory(src/miniserver)
add_subdirectory(src/webarch)
add_subdirectory(src/web)