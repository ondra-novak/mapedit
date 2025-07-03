add_executable(mapedit_server 
    main.cpp 
    server.cpp 
    handler_map.cpp 
    ddlman.cpp 
    interface.cpp
    mgifdecomp.cpp
    mgifcomp.cpp
    utils/mgifmem.c
    utils/mgifcreate.cpp
    utils/lzw.c
    utils/profile_path.cpp
    )
add_dependencies(mapedit_server frontend)
