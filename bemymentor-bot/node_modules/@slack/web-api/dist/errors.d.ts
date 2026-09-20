import type { WebAPICallResult } from './WebClient';
/**
 * @deprecated Use `instanceof` checks with specific error classes (e.g. `WebAPIPlatformError`) or the `SlackError` base class instead.
 */
export interface CodedError extends NodeJS.ErrnoException {
    code: ErrorCode;
}
/**
 * A dictionary of codes for errors produced by this package
 */
export declare enum ErrorCode {
    RequestError = "slack_webapi_request_error",
    HTTPError = "slack_webapi_http_error",
    PlatformError = "slack_webapi_platform_error",
    RateLimitedError = "slack_webapi_rate_limited_error",
    FileUploadInvalidArgumentsError = "slack_webapi_file_upload_invalid_args_error",
    FileUploadReadFileDataError = "slack_webapi_file_upload_read_file_data_error"
}
export type WebAPICallError = WebAPIPlatformError | WebAPIRequestError | WebAPIHTTPError | WebAPIRateLimitedError;
export type WebAPIFilesUploadError = WebAPIFileUploadInvalidArgumentsError | WebAPIFileUploadReadFileDataError;
export declare abstract class SlackError extends Error {
    abstract readonly code: ErrorCode;
    constructor(message: string, options?: ErrorOptions);
}
export declare class WebAPIPlatformError extends SlackError {
    readonly code = ErrorCode.PlatformError;
    readonly data: WebAPICallResult & {
        error: string;
    };
    constructor(result: WebAPICallResult & {
        error: string;
    });
}
export declare class WebAPIRequestError extends SlackError {
    readonly code = ErrorCode.RequestError;
    readonly original: Error;
    constructor(original: Error);
}
export declare class WebAPIHTTPError extends SlackError {
    readonly code = ErrorCode.HTTPError;
    readonly statusCode: number;
    readonly statusMessage: string;
    readonly headers: Record<string, string>;
    readonly body?: any;
    constructor(statusCode: number, statusMessage: string, headers: Record<string, string>, body?: any);
}
export declare class WebAPIRateLimitedError extends SlackError {
    readonly code = ErrorCode.RateLimitedError;
    readonly retryAfter: number;
    constructor(retryAfter: number);
}
export declare class WebAPIFileUploadInvalidArgumentsError extends SlackError {
    readonly code = ErrorCode.FileUploadInvalidArgumentsError;
}
export declare class WebAPIFileUploadReadFileDataError extends SlackError {
    readonly code = ErrorCode.FileUploadReadFileDataError;
}
//# sourceMappingURL=errors.d.ts.map