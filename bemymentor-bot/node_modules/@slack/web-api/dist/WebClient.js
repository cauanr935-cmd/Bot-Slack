"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebClient = exports.WebClientEvent = void 0;
exports.buildThreadTsWarningMessage = buildThreadTsWarningMessage;
const node_path_1 = require("node:path");
const node_querystring_1 = require("node:querystring");
const node_util_1 = require("node:util");
const node_zlib_1 = __importDefault(require("node:zlib"));
const p_queue_1 = __importDefault(require("p-queue"));
const p_retry_1 = __importStar(require("p-retry"));
const chat_stream_1 = require("./chat-stream");
const errors_1 = require("./errors");
const file_upload_1 = require("./file-upload");
const helpers_1 = __importDefault(require("./helpers"));
const instrument_1 = require("./instrument");
const logger_1 = require("./logger");
const methods_1 = require("./methods");
const retry_policies_1 = require("./retry-policies");
/*
 * Helpers
 */
const defaultFilename = 'Untitled';
const defaultPageSize = 200;
const noopPageReducer = () => undefined;
var WebClientEvent;
(function (WebClientEvent) {
    // TODO: safe to rename this to conform to PascalCase enum type naming convention?
    WebClientEvent["RATE_LIMITED"] = "rate_limited";
})(WebClientEvent || (exports.WebClientEvent = WebClientEvent = {}));
/**
 * A client for Slack's Web API
 *
 * This client provides an alias for each {@link https://docs.slack.dev/reference/methods|Web API method}. Each method is
 * a convenience wrapper for calling the {@link WebClient#apiCall} method using the method name as the first parameter.
 */
class WebClient extends methods_1.Methods {
    /**
     * The base URL for reaching Slack's Web API. Consider changing this value for testing purposes.
     */
    slackApiUrl;
    /**
     * Authentication and authorization token for accessing Slack Web API (usually begins with `xoxp` or `xoxb`)
     */
    token;
    /**
     * Configuration for retry operations. See {@link https://github.com/tim-kos/node-retry|node-retry} for more details.
     */
    retryConfig;
    /**
     * Queue of requests in which a maximum of {@link WebClientOptions.maxRequestConcurrency} can concurrently be
     * in-flight.
     */
    requestQueue;
    /**
     * The fetch function used for HTTP requests
     */
    fetchFn;
    /**
     * Request timeout in milliseconds
     */
    timeout;
    /**
     * Default headers sent with every request
     */
    defaultHeaders;
    /**
     * Preference for immediately rejecting API calls which result in a rate-limited response
     */
    rejectRateLimitedCalls;
    /**
     * The name used to prefix all logging generated from this object
     */
    static loggerName = 'WebClient';
    /**
     * This object's logger instance
     */
    logger;
    /**
     * This object's teamId value
     */
    teamId;
    allowAbsoluteUrls;
    /**
     * @param token - An API token to authenticate/authorize with Slack (usually start with `xoxp`, `xoxb`)
     * @param {Object} [webClientOptions] - Configuration options.
     */
    constructor(token, { slackApiUrl = 'https://slack.com/api/', logger = undefined, logLevel = undefined, maxRequestConcurrency = 100, retryConfig = retry_policies_1.tenRetriesInAboutThirtyMinutes, fetch = undefined, timeout = 0, rejectRateLimitedCalls = false, headers = {}, teamId = undefined, allowAbsoluteUrls = true, } = {}) {
        super();
        this.token = token;
        this.slackApiUrl = slackApiUrl;
        if (!this.slackApiUrl.endsWith('/')) {
            this.slackApiUrl += '/';
        }
        this.retryConfig = retryConfig;
        this.requestQueue = new p_queue_1.default({ concurrency: maxRequestConcurrency });
        this.rejectRateLimitedCalls = rejectRateLimitedCalls;
        this.teamId = teamId;
        this.allowAbsoluteUrls = allowAbsoluteUrls;
        // Logging
        if (typeof logger !== 'undefined') {
            this.logger = logger;
            if (typeof logLevel !== 'undefined') {
                this.logger.debug('The logLevel given to WebClient was ignored as you also gave logger');
            }
        }
        else {
            this.logger = (0, logger_1.getLogger)(WebClient.loggerName, logLevel ?? logger_1.LogLevel.INFO, logger);
        }
        if (this.token && !headers.Authorization)
            headers.Authorization = `Bearer ${this.token}`;
        this.fetchFn = fetch ?? globalThis.fetch;
        this.timeout = timeout;
        this.defaultHeaders = { 'User-Agent': (0, instrument_1.getUserAgent)(), Accept: 'application/json', ...headers };
        this.logger.debug('initialized');
    }
    /**
     * Generic method for calling a Web API method
     * @param method - the Web API method to call {@link https://docs.slack.dev/reference/methods}
     * @param options - arguments for the Web API method
     */
    async apiCall(method, options = {}) {
        this.logger.debug(`apiCall('${method}') start`);
        warnDeprecations(method, this.logger);
        warnIfFallbackIsMissing(method, this.logger, options);
        warnIfThreadTsIsNotString(method, this.logger, options);
        if (typeof options === 'string' || typeof options === 'number' || typeof options === 'boolean') {
            throw new TypeError(`Expected an options argument but instead received a ${typeof options}`);
        }
        // @ts-expect-error insufficient overlap between Record and FilesUploadV2Arguments
        if (method === 'files.uploadV2')
            return this.filesUploadV2(options);
        const headers = {};
        if (options.token)
            headers.Authorization = `Bearer ${options.token}`;
        const url = this.deriveRequestUrl(method);
        const response = await this.makeRequest(url, {
            team_id: this.teamId,
            ...options,
        }, headers);
        const result = await this.buildResult(response);
        this.logger.debug(`http request result: ${JSON.stringify(redact(result))}`);
        // log warnings in response metadata
        if (result.response_metadata !== undefined && result.response_metadata.warnings !== undefined) {
            result.response_metadata.warnings.forEach(this.logger.warn.bind(this.logger));
        }
        // log warnings and errors in response metadata messages
        // related to https://docs.slack.dev/changelog/2016/09/28/response-metadata-is-on-the-way
        if (result.response_metadata !== undefined && result.response_metadata.messages !== undefined) {
            for (const msg of result.response_metadata.messages) {
                const errReg = /\[ERROR\](.*)/;
                const warnReg = /\[WARN\](.*)/;
                if (errReg.test(msg)) {
                    const errMatch = msg.match(errReg);
                    if (errMatch != null) {
                        this.logger.error(errMatch[1].trim());
                    }
                }
                else if (warnReg.test(msg)) {
                    const warnMatch = msg.match(warnReg);
                    if (warnMatch != null) {
                        this.logger.warn(warnMatch[1].trim());
                    }
                }
            }
        }
        // If result's content is gzip, "ok" property is not returned with successful response
        // TODO: look into simplifying this code block to only check for the second condition
        // if an { ok: false } body applies for all API errors
        if (!result.ok && response.headers.get('content-type') !== 'application/gzip') {
            throw new errors_1.WebAPIPlatformError(result);
        }
        if ('ok' in result && result.ok === false) {
            throw new errors_1.WebAPIPlatformError(result);
        }
        this.logger.debug(`apiCall('${method}') end`);
        return result;
    }
    paginate(method, options, shouldStop, reduce) {
        const pageSize = (() => {
            if (options !== undefined && typeof options.limit === 'number') {
                const { limit } = options;
                options.limit = undefined;
                return limit;
            }
            return defaultPageSize;
        })();
        async function* generatePages() {
            // when result is undefined, that signals that the first of potentially many calls has not yet been made
            let result;
            // paginationOptions stores pagination options not already stored in the options argument
            let paginationOptions = {
                limit: pageSize,
            };
            if (options !== undefined && options.cursor !== undefined) {
                paginationOptions.cursor = options.cursor;
            }
            // NOTE: test for the situation where you're resuming a pagination using and existing cursor
            while (result === undefined || paginationOptions !== undefined) {
                result = await this.apiCall(method, Object.assign(options !== undefined ? options : {}, paginationOptions));
                yield result;
                paginationOptions = paginationOptionsForNextPage(result, pageSize);
            }
        }
        if (shouldStop === undefined) {
            return generatePages.call(this);
        }
        const pageReducer = reduce !== undefined ? reduce : noopPageReducer;
        let index = 0;
        return (async () => {
            // Unroll the first iteration of the iterator
            // This is done primarily because in order to satisfy the type system, we need a variable that is typed as A
            // (shown as accumulator before), but before the first iteration all we have is a variable typed A | undefined.
            // Unrolling the first iteration allows us to deal with undefined as a special case.
            const pageIterator = generatePages.call(this);
            const firstIteratorResult = await pageIterator.next(undefined);
            // Assumption: there will always be at least one result in a paginated API request
            // if (firstIteratorResult.done) { return; }
            const firstPage = firstIteratorResult.value;
            let accumulator = pageReducer(undefined, firstPage, index);
            index += 1;
            if (shouldStop(firstPage)) {
                return accumulator;
            }
            // Continue iteration
            for await (const page of pageIterator) {
                accumulator = pageReducer(accumulator, page, index);
                if (shouldStop(page)) {
                    return accumulator;
                }
                index += 1;
            }
            return accumulator;
        })();
    }
    /**
     * Stream markdown text into a conversation.
     *
     * @description The "chatStream" method starts a new chat stream in a conversation that can be appended to. After appending an entire message, the stream can be stopped with concluding arguments such as "blocks" for gathering feedback.
     *
     * The "markdown_text" content is appended to a buffer before being sent to the recipient, with a default buffer size of "256" characters. Setting the "buffer_size" value to a smaller number sends more frequent updates for the same amount of characters, but might reach rate limits more often.
     *
     * @example
     * const streamer = client.chatStream({
     *   channel: "C0123456789",
     *   thread_ts: "1700000001.123456",
     *   recipient_team_id: "T0123456789",
     *   recipient_user_id: "U0123456789",
     * });
     * await streamer.append({
     *   markdown_text: "**hello wo",
     * });
     * await streamer.append({
     *   markdown_text: "rld!**",
     * });
     * await streamer.stop();
     *
     * @see {@link https://docs.slack.dev/reference/methods/chat.startStream}
     * @see {@link https://docs.slack.dev/reference/methods/chat.appendStream}
     * @see {@link https://docs.slack.dev/reference/methods/chat.stopStream}
     */
    chatStream(params) {
        const { buffer_size, ...args } = params;
        const options = {
            buffer_size,
        };
        return new chat_stream_1.ChatStreamer(this, this.logger, args, options);
    }
    /**
     * This wrapper method provides an easy way to upload files using the following endpoints:
     *
     * **#1**: For each file submitted with this method, submit filenames
     * and file metadata to {@link https://docs.slack.dev/reference/methods/files.getuploadurlexternal files.getUploadURLExternal} to request a URL to
     * which to send the file data to and an id for the file
     *
     * **#2**: for each returned file `upload_url`, upload corresponding file to
     * URLs returned from step 1 (e.g. https://files.slack.com/upload/v1/...\")
     *
     * **#3**: Complete uploads {@link https://docs.slack.dev/reference/methods/files.completeuploadexternal files.completeUploadExternal}
     * @param options
     */
    async filesUploadV2(options) {
        this.logger.debug('files.uploadV2() start');
        // 1
        const fileUploads = await this.getAllFileUploads(options);
        const fileUploadsURLRes = await this.fetchAllUploadURLExternal(fileUploads);
        // set the upload_url and file_id returned from Slack
        fileUploadsURLRes.forEach((res, idx) => {
            fileUploads[idx].upload_url = res.upload_url;
            fileUploads[idx].file_id = res.file_id;
        });
        // 2
        await this.postFileUploadsToExternalURL(fileUploads, options);
        // 3
        const completion = await this.completeFileUploads(fileUploads);
        return { ok: true, files: completion };
    }
    /**
     * For each file submitted with this method, submits filenames
     * and file metadata to files.getUploadURLExternal to request a URL to
     * which to send the file data to and an id for the file
     * @param fileUploads
     */
    async fetchAllUploadURLExternal(fileUploads) {
        return Promise.all(fileUploads.map((upload) => {
            const options = {
                filename: upload.filename,
                length: upload.length,
                alt_text: upload.alt_text,
                snippet_type: upload.snippet_type,
            };
            if ('token' in upload) {
                options.token = upload.token;
            }
            return this.files.getUploadURLExternal(options);
        }));
    }
    /**
     * Complete uploads.
     * @param fileUploads
     * @returns
     */
    async completeFileUploads(fileUploads) {
        const toComplete = Object.values((0, file_upload_1.getAllFileUploadsToComplete)(fileUploads));
        return Promise.all(toComplete.map((job) => this.files.completeUploadExternal(job)));
    }
    /**
     * for each returned file upload URL, upload corresponding file
     * @param fileUploads
     * @returns
     */
    async postFileUploadsToExternalURL(fileUploads, options) {
        return Promise.all(fileUploads.map(async (upload) => {
            const { upload_url, file_id, filename, data } = upload;
            // either file or content will be defined
            const body = data;
            // try to post to external url
            if (upload_url) {
                const headers = {};
                if (options.token)
                    headers.Authorization = `Bearer ${options.token}`;
                const uploadRes = await this.makeRequest(upload_url, {
                    body,
                }, headers);
                if (uploadRes.status !== 200) {
                    return Promise.reject(Error(`Failed to upload file (id:${file_id}, filename: ${filename})`));
                }
                const responseBody = await uploadRes.text();
                const returnData = { ok: true, body: responseBody };
                return Promise.resolve(returnData);
            }
            return Promise.reject(Error(`No upload url found for file (id: ${file_id}, filename: ${filename}`));
        }));
    }
    /**
     * @param options All file uploads arguments
     * @returns An array of file upload entries
     */
    async getAllFileUploads(options) {
        let fileUploads = [];
        // add single file data to uploads if file or content exists at the top level
        if ('file' in options || 'content' in options) {
            fileUploads.push(await (0, file_upload_1.getFileUploadJob)(options, this.logger));
        }
        // add multiple files data when file_uploads is supplied
        if ('file_uploads' in options) {
            fileUploads = fileUploads.concat(await (0, file_upload_1.getMultipleFileUploadJobs)(options, this.logger));
        }
        return fileUploads;
    }
    /**
     * Low-level function to make a single API request. handles queuing, retries, and http-level errors
     */
    async makeRequest(url, body, headers = {}) {
        const task = () => this.requestQueue.add(async () => {
            // apps.event.authorizations.list will reject HTTP requests that send token in the body
            // TODO: consider applying this change to all methods - though that will require thorough integration testing
            if (url.endsWith('/apps.event.authorizations.list')) {
                body.token = undefined;
            }
            this.logger.debug(`http request url: ${url}`);
            this.logger.debug(`http request body: ${JSON.stringify(redact(body))}`);
            const { serializedBody, contentHeaders } = this.serializeBody(body);
            const allHeaders = { ...this.defaultHeaders, ...contentHeaders, ...headers };
            this.logger.debug(`http request headers: ${JSON.stringify(redact(allHeaders))}`);
            const signal = this.timeout > 0 ? AbortSignal.timeout(this.timeout) : undefined;
            try {
                const response = await this.fetchFn(url, {
                    method: 'POST',
                    headers: allHeaders,
                    body: serializedBody,
                    redirect: 'error',
                    signal,
                });
                this.logger.debug('http response received');
                if (response.status === 429) {
                    const retrySec = parseRetryHeaders(response);
                    if (retrySec !== undefined) {
                        this.emit(WebClientEvent.RATE_LIMITED, retrySec, { url, body });
                        if (this.rejectRateLimitedCalls) {
                            throw new p_retry_1.AbortError(new errors_1.WebAPIRateLimitedError(retrySec));
                        }
                        this.logger.info(`API Call failed due to rate limiting. Will retry in ${retrySec} seconds.`);
                        // pause the request queue and then delay the rejection by the amount of time in the retry header
                        this.requestQueue.pause();
                        // NOTE: if there was a way to introspect the current RetryOperation and know what the next timeout
                        // would be, then we could subtract that time from the following delay, knowing that the next
                        // attempt still wouldn't occur until after the rate-limit header has specified. An even better
                        // solution would be to subtract the time from only the timeout of this next attempt of the
                        // RetryOperation. This would result in staying paused for the entire duration specified in the
                        // header, yet this operation not having to pay the timeout cost in addition to that.
                        await (0, helpers_1.default)(retrySec * 1000);
                        // resume the request queue and throw a non-abort error to signal a retry
                        this.requestQueue.start();
                        // TODO: We may want to have more detailed info such as team_id, params except tokens, and so on.
                        throw new Error(`A rate limit was exceeded (url: ${url}, retry-after: ${retrySec})`);
                    }
                    // TODO: turn this into some CodedError
                    throw new p_retry_1.AbortError(new Error(`Retry header did not contain a valid timeout (url: ${url}, retry-after header: ${response.headers.get('retry-after')})`));
                }
                // Slack's Web API doesn't use meaningful status codes besides 429 and 200
                if (response.status !== 200) {
                    const responseBody = await response.text();
                    throw new errors_1.WebAPIHTTPError(response.status, response.statusText, Object.fromEntries(response.headers.entries()), responseBody);
                }
                return response;
            }
            catch (error) {
                if (error instanceof p_retry_1.AbortError) {
                    throw error;
                }
                if (error instanceof errors_1.SlackError) {
                    throw error;
                }
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn('http request failed', message);
                throw new errors_1.WebAPIRequestError(error instanceof Error ? error : new Error(String(error)));
            }
        });
        return (0, p_retry_1.default)(task, this.retryConfig);
    }
    /**
     * Get the complete request URL for the provided URL.
     * @param url - The resource to POST to. Either a Slack API method or absolute URL.
     */
    deriveRequestUrl(url) {
        const isAbsoluteURL = url.startsWith('https://') || url.startsWith('http://');
        if (isAbsoluteURL && this.allowAbsoluteUrls) {
            return url;
        }
        return `${this.slackApiUrl}${url}`;
    }
    /**
     * Transforms a key-value object into a serialized body suitable for fetch.
     * Flattens complex objects into JSON-encoded strings, detects binary content,
     * and returns either a FormData (for binary uploads) or a URL-encoded string,
     * along with any content-type headers that should be set.
     */
    serializeBody(data) {
        let containsBinaryData = false;
        // biome-ignore lint/suspicious/noExplicitAny: HTTP request data can be anything
        const flattened = Object.entries(data).map(([key, value]) => {
            if (value === undefined || value === null) {
                return [];
            }
            let serializedValue = value;
            if (Buffer.isBuffer(value)) {
                containsBinaryData = true;
            }
            else if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
                // if value is anything other than string, number, boolean, binary data, a Stream, or a Buffer, then encode it
                // as a JSON string.
                serializedValue = JSON.stringify(value);
            }
            return [key, serializedValue];
        });
        // A body with binary content should be serialized as multipart/form-data
        if (containsBinaryData) {
            this.logger.debug('Request arguments contain binary data');
            const form = new FormData();
            for (const [key, value] of flattened) {
                if (key === undefined || value === undefined)
                    continue;
                if (Buffer.isBuffer(value)) {
                    const streamOrBuffer = value;
                    let filename = defaultFilename;
                    if (typeof streamOrBuffer.name === 'string') {
                        filename = (0, node_path_1.basename)(streamOrBuffer.name);
                    }
                    else if (typeof streamOrBuffer.path === 'string') {
                        filename = (0, node_path_1.basename)(streamOrBuffer.path);
                    }
                    form.append(key, new Blob([new Uint8Array(value)]), filename);
                }
                else {
                    form.append(key, String(value));
                }
            }
            // Do not set Content-Type — fetch auto-generates the multipart boundary
            return { serializedBody: form, contentHeaders: {} };
        }
        // Otherwise, serialize as url-encoded key-value pairs
        // biome-ignore lint/suspicious/noExplicitAny: form values can be anything
        const initialValue = {};
        const encoded = (0, node_querystring_1.stringify)(flattened.reduce((accumulator, [key, value]) => {
            if (key !== undefined && value !== undefined) {
                accumulator[key] = value;
            }
            return accumulator;
        }, initialValue));
        return {
            serializedBody: encoded,
            contentHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
        };
    }
    /**
     * Processes an HTTP response into a WebAPICallResult by performing JSON parsing on the body and merging relevant
     * HTTP headers into the object.
     * @param response - an http response
     */
    async buildResult(response) {
        const contentType = response.headers.get('content-type');
        const isGzipResponse = contentType === 'application/gzip';
        // biome-ignore lint/suspicious/noExplicitAny: HTTP response data can be anything
        let data;
        // admin.analytics.getFile returns a gzip binary response that can be unzipped
        if (isGzipResponse) {
            try {
                const buffer = Buffer.from(await response.arrayBuffer());
                const unzippedData = await new Promise((resolve, reject) => {
                    node_zlib_1.default.unzip(buffer, (err, buf) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(buf.toString().split('\n'));
                    });
                });
                const fileData = [];
                if (Array.isArray(unzippedData)) {
                    for (const dataset of unzippedData) {
                        if (dataset && dataset.length > 0) {
                            fileData.push(JSON.parse(dataset));
                        }
                    }
                }
                data = { file_data: fileData };
            }
            catch (err) {
                data = { ok: false, error: err };
            }
        }
        else if (!isGzipResponse && response.url.endsWith('/admin.analytics.getFile')) {
            // if it isn't a Gzip response but is from the admin.analytics.getFile request,
            // decode the ArrayBuffer to JSON read the error
            const buffer = await response.arrayBuffer();
            data = JSON.parse(new node_util_1.TextDecoder().decode(buffer));
        }
        else {
            const text = await response.text();
            try {
                data = JSON.parse(text);
            }
            catch (_) {
                // failed to parse the response body as JSON
                data = { ok: false, error: text };
            }
        }
        if (data.response_metadata === undefined) {
            data.response_metadata = {};
        }
        // add scopes metadata from headers
        const oauthScopes = response.headers.get('x-oauth-scopes');
        if (oauthScopes !== null) {
            data.response_metadata.scopes = oauthScopes.trim().split(/\s*,\s*/);
        }
        const acceptedOauthScopes = response.headers.get('x-accepted-oauth-scopes');
        if (acceptedOauthScopes !== null) {
            data.response_metadata.acceptedScopes = acceptedOauthScopes.trim().split(/\s*,\s*/);
        }
        // add retry metadata from headers
        const retrySec = parseRetryHeaders(response);
        if (retrySec !== undefined) {
            data.response_metadata.retryAfter = retrySec;
        }
        return data;
    }
}
exports.WebClient = WebClient;
exports.default = WebClient;
/**
 * Determines an appropriate set of cursor pagination options for the next request to a paginated API method.
 * @param previousResult - the result of the last request, where the next cursor might be found.
 * @param pageSize - the maximum number of additional items to fetch in the next request.
 */
function paginationOptionsForNextPage(previousResult, pageSize) {
    if (previousResult !== undefined &&
        previousResult.response_metadata !== undefined &&
        previousResult.response_metadata.next_cursor !== undefined &&
        previousResult.response_metadata.next_cursor !== '') {
        return {
            limit: pageSize,
            cursor: previousResult.response_metadata.next_cursor,
        };
    }
    return undefined;
}
/**
 * Extract the amount of time (in seconds) the platform has recommended this client wait before sending another request
 * from a rate-limited HTTP response (statusCode = 429).
 */
function parseRetryHeaders(response) {
    const retryAfterHeader = response.headers.get('retry-after');
    if (retryAfterHeader !== null) {
        const retryAfter = Number.parseInt(retryAfterHeader, 10);
        if (!Number.isNaN(retryAfter)) {
            return retryAfter;
        }
    }
    return undefined;
}
/**
 * Log a warning when using a deprecated method
 * @param method api method being called
 * @param logger instance of web clients logger
 */
function warnDeprecations(method, logger) {
    const deprecatedMethods = ['oauth.access'];
    const isDeprecated = deprecatedMethods.some((depMethod) => {
        const re = new RegExp(`^${depMethod}`);
        return re.test(method);
    });
    if (isDeprecated) {
        logger.warn(`${method} is deprecated. Please check on https://docs.slack.dev/reference/methods for an alternative.`);
    }
}
/**
 * Log a warning when using chat.postMessage without text argument or attachments with fallback argument
 * @param method api method being called
 * @param logger instance of we clients logger
 * @param options arguments for the Web API method
 */
function warnIfFallbackIsMissing(method, logger, options) {
    const targetMethods = ['chat.postEphemeral', 'chat.postMessage', 'chat.scheduleMessage'];
    const isTargetMethod = targetMethods.includes(method);
    const hasAttachments = (args) => Array.isArray(args.attachments) && args.attachments.length;
    const missingAttachmentFallbackDetected = (args) => Array.isArray(args.attachments) &&
        args.attachments.some((attachment) => !attachment.fallback || attachment.fallback.trim() === '');
    const isEmptyText = (args) => (args.text === undefined || args.text === null || args.text === '') &&
        (args.markdown_text === undefined || args.markdown === null || args.markdown_text === '');
    const buildMissingTextWarning = () => `The top-level \`text\` argument is missing in the request payload for a ${method} call - It's a best practice to always provide a \`text\` argument when posting a message. The \`text\` is used in places where the content cannot be rendered such as: system push notifications, assistive technology such as screen readers, etc.`;
    const buildMissingFallbackWarning = () => `Additionally, the attachment-level \`fallback\` argument is missing in the request payload for a ${method} call - To avoid this warning, it is recommended to always provide a top-level \`text\` argument when posting a message. Alternatively, you can provide an attachment-level \`fallback\` argument, though this is now considered a legacy field (see https://docs.slack.dev/legacy/legacy-messaging/legacy-secondary-message-attachments for more details).`;
    if (isTargetMethod && typeof options === 'object') {
        if (hasAttachments(options)) {
            if (missingAttachmentFallbackDetected(options) && isEmptyText(options)) {
                logger.warn(buildMissingTextWarning());
                logger.warn(buildMissingFallbackWarning());
            }
        }
        else if (isEmptyText(options)) {
            logger.warn(buildMissingTextWarning());
        }
    }
}
/**
 * Log a warning when thread_ts is not a string
 * @param method api method being called
 * @param logger instance of web clients logger
 * @param options arguments for the Web API method
 */
function warnIfThreadTsIsNotString(method, logger, options) {
    const targetMethods = ['chat.postEphemeral', 'chat.postMessage', 'chat.scheduleMessage'];
    const isTargetMethod = targetMethods.includes(method);
    if (isTargetMethod && options?.thread_ts !== undefined && typeof options?.thread_ts !== 'string') {
        logger.warn(buildThreadTsWarningMessage(method));
    }
}
function buildThreadTsWarningMessage(method) {
    return `The given thread_ts value in the request payload for a ${method} call is a float value. We highly recommend using a string value instead.`;
}
/**
 * Takes an object and redacts specific items
 * @param body
 * @returns
 */
function redact(body) {
    // biome-ignore lint/suspicious/noExplicitAny: objects can be anything
    const flattened = Object.entries(body).map(([key, value]) => {
        // no value provided
        if (value === undefined || value === null) {
            return [];
        }
        let serializedValue = value;
        // redact possible tokens
        if (key.match(/.*token.*/) !== null || key.match(/[Aa]uthorization/)) {
            serializedValue = '[[REDACTED]]';
        }
        // when value is buffer we can avoid logging it
        if (Buffer.isBuffer(value)) {
            serializedValue = '[[BINARY VALUE OMITTED]]';
        }
        else if (typeof value === 'object') {
            serializedValue = redact(value);
        }
        return [key, serializedValue];
    });
    // return as object
    const initialValue = {};
    return flattened.reduce((accumulator, [key, value]) => {
        if (key !== undefined && value !== undefined) {
            accumulator[key] = value;
        }
        return accumulator;
    }, initialValue);
}
//# sourceMappingURL=WebClient.js.map