add_executable(mapedit_server main.cpp server.cpp handler_map.cpp ddlman.cpp interface.cpp)
add_dependencies(mapedit_server frontend)
