set(DEPFILE_PATH ${CMAKE_BINARY_DIR}/vue.dep)

add_custom_command(
    OUTPUT ${CMAKE_BINARY_DIR}/web/index.html
    COMMAND ${CMAKE_COMMAND} -E env VITE_OUTPUT_DIR=${CMAKE_BINARY_DIR}/web node generate-vue-deps.js ${DEPFILE_PATH}
    COMMAND ${CMAKE_COMMAND} -E env VITE_OUTPUT_DIR=${CMAKE_BINARY_DIR}/web npm run build
    DEPFILE ${DEPFILE_PATH}
    WORKING_DIRECTORY ${CMAKE_CURRENT_LIST_DIR}
    COMMENT "Building Vue frontend"
    
)

add_custom_target(frontend DEPENDS ${CMAKE_BINARY_DIR}/web/index.html
)