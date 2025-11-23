"use strict";
exports.id = 653;
exports.ids = [653];
exports.modules = {

/***/ 653:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Z: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(648);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([axios__WEBPACK_IMPORTED_MODULE_0__]);
axios__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];

const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const api = axios__WEBPACK_IMPORTED_MODULE_0__["default"].create({
    baseURL,
    timeout: 30000
});
// Add API key to all requests
api.interceptors.request.use((config)=>{
    if (false) {}
    return config;
});
// Handle errors
api.interceptors.response.use((response)=>response, (error)=>{
    if (error.response?.status === 401) {
        // Unauthorized - clear session and redirect to login
        if (false) {}
    }
    return Promise.reject(error);
});
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (api);

__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ })

};
;