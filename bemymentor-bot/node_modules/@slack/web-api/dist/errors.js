"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebAPIFileUploadReadFileDataError = exports.WebAPIFileUploadInvalidArgumentsError = exports.WebAPIRateLimitedError = exports.WebAPIHTTPError = exports.WebAPIRequestError = exports.WebAPIPlatformError = exports.SlackError = exports.ErrorCode = void 0;
/**
 * A dictionary of codes for errors produced by this package
 */
var ErrorCode;
(function (ErrorCode) {
    // general error
    ErrorCode["RequestError"] = "slack_webapi_request_error";
    ErrorCode["HTTPError"] = "slack_webapi_http_error";
    ErrorCode["PlatformError"] = "slack_webapi_platform_error";
    ErrorCode["RateLimitedError"] = "slack_webapi_rate_limited_error";
    // file uploads errors
    ErrorCode["FileUploadInvalidArgumentsError"] = "slack_webapi_file_upload_invalid_args_error";
    ErrorCode["FileUploadReadFileDataError"] = "slack_webapi_file_upload_read_file_data_error";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class SlackError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.SlackError = SlackError;
class WebAPIPlatformError extends SlackError {
    code = ErrorCode.PlatformError;
    data;
    constructor(result) {
        super(`An API error occurred: ${result.error}`);
        this.data = result;
    }
}
exports.WebAPIPlatformError = WebAPIPlatformError;
class WebAPIRequestError extends SlackError {
    code = ErrorCode.RequestError;
    original;
    constructor(original) {
        super(`A request error occurred: ${original.message}`, { cause: original });
        this.original = original;
    }
}
exports.WebAPIRequestError = WebAPIRequestError;
class WebAPIHTTPError extends SlackError {
    code = ErrorCode.HTTPError;
    statusCode;
    statusMessage;
    headers;
    // biome-ignore lint/suspicious/noExplicitAny: HTTP response bodies might be anything
    body;
    constructor(statusCode, statusMessage, headers, 
    // biome-ignore lint/suspicious/noExplicitAny: HTTP response bodies might be anything
    body) {
        super(`An HTTP protocol error occurred: statusCode = ${statusCode}`);
        this.statusCode = statusCode;
        this.statusMessage = statusMessage;
        this.headers = headers;
        if (typeof body === 'string') {
            try {
                this.body = JSON.parse(body);
            }
            catch {
                this.body = body;
            }
        }
        else {
            this.body = body;
        }
    }
}
exports.WebAPIHTTPError = WebAPIHTTPError;
class WebAPIRateLimitedError extends SlackError {
    code = ErrorCode.RateLimitedError;
    retryAfter;
    constructor(retryAfter) {
        super(`A rate-limit has been reached, you may retry this request in ${retryAfter} seconds`);
        this.retryAfter = retryAfter;
    }
}
exports.WebAPIRateLimitedError = WebAPIRateLimitedError;
class WebAPIFileUploadInvalidArgumentsError extends SlackError {
    code = ErrorCode.FileUploadInvalidArgumentsError;
}
exports.WebAPIFileUploadInvalidArgumentsError = WebAPIFileUploadInvalidArgumentsError;
class WebAPIFileUploadReadFileDataError extends SlackError {
    code = ErrorCode.FileUploadReadFileDataError;
}
exports.WebAPIFileUploadReadFileDataError = WebAPIFileUploadReadFileDataError;
//# sourceMappingURL=errors.js.map