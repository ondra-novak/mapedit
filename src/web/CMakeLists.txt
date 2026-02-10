set(WEB_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/src")
set(WEB_BUILD_DIR "${CMAKE_BINARY_DIR}/web")
file(GLOB_RECURSE WEB_SOURCES CONFIGURE_DEPENDS
    "${WEB_SRC_DIR}/*.vue"
    "${WEB_SRC_DIR}/*.ts"
    "${WEB_SRC_DIR}/*.js"
    "${WEB_SRC_DIR}/*.json"
    "${WEB_SRC_DIR}/*.html"
    "${WEB_SRC_DIR}/*.css"
    "${WEB_SRC_DIR}/*.scss"
)


add_custom_command(OUTPUT ${WEB_SRC_DIR}/generated/parser.js
    COMMAND ${CMAKE_COMMAND} -E env VITE_OUTPUT_DIR=${WEB_BUILD_DIR} ${CMDPREFIX} npm ci
    COMMAND ${CMAKE_COMMAND} -E make_directory ${WEB_SRC_DIR}/generated
    COMMAND ${CMAKE_COMMAND} -E copy ${WEB_SRC_DIR}/peggy/parser.d.ts ${WEB_SRC_DIR}/generated/
    COMMAND ${CMDPREFIX} npx peggy ${WEB_SRC_DIR}/peggy/dialogs.peggy -o ${WEB_SRC_DIR}/generated/parser.js --format es

    WORKING_DIRECTORY ${WEB_SRC_DIR}
    DEPENDS ${WEB_SRC_DIR}/peggy/dialogs.peggy ${WEB_SRC_DIR}/peggy/parser.d.ts
)

add_custom_command(OUTPUT ${WEB_BUILD_DIR}/index.html    
    COMMAND ${CMAKE_COMMAND} -E env VITE_OUTPUT_DIR=${WEB_BUILD_DIR} ${CMDPREFIX} npm run build
    WORKING_DIRECTORY ${WEB_SRC_DIR}
    DEPENDS ${WEB_SOURCES} ${WEB_SRC_DIR}/generated/parser.js
    BYPRODUCTS ${WEB_BUILD_DIR} 
    COMMENT "Building web frontend with npm..."
)

add_custom_target(frontend ALL DEPENDS ${WEB_BUILD_DIR}/index.html)

