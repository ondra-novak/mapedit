set(GENERATED_H ${CMAKE_BINARY_DIR}/webpage_content.hpp)


add_custom_command(
    OUTPUT ${GENERATED_H}
    COMMAND web2cpp ${CMAKE_BINARY_DIR}/web > ${GENERATED_H}
    DEPENDS frontend web2cpp
    COMMENT "Generating webpage"
)

set_source_files_properties(
    webpage.cpp
    PROPERTIES
        OBJECT_DEPENDS ${GENERATED_H}
)


add_library(mapedit_server_webcontent webpage.cpp ${GENERATED_H})


add_executable(mapedit_server 
    main.cpp 
    server.cpp 
    handler_map.cpp 
    ddlman.cpp 
    interface.cpp
    skeldal_exe.cpp
    mgifdecomp.cpp
    mgifcomp.cpp
    wsrpc.cpp
    publisher.cpp
    langfiles.cpp
    publish_helper.cpp
    utils/mgifmem.c
    utils/mgifcreate.cpp
    utils/lzw.c
    utils/profile_path.cpp
    utils/fast_copy_file.cpp
    )

target_link_libraries(mapedit_server PRIVATE mapedit_server_webcontent)
