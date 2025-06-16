add_executable(mapedit_server 
    main.cpp 
    server.cpp 
    handler_map.cpp 
    ddlman.cpp 
    interface.cpp
    mgifdecomp.cpp
    utils/mgifmem.c
    utils/mgifcreate.cpp
    )
add_dependencies(mapedit_server frontend)
