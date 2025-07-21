add_executable(mapedit_server 
    main.cpp 
    server.cpp 
    handler_map.cpp 
    ddlman.cpp 
    interface.cpp
    skeldal_exe.cpp
    mgifdecomp.cpp
    mgifcomp.cpp
    utils/mgifmem.c
    utils/mgifcreate.cpp
    utils/lzw.c
    utils/profile_path.cpp
    utils/fast_copy_file.cpp
    )
add_dependencies(mapedit_server frontend)
