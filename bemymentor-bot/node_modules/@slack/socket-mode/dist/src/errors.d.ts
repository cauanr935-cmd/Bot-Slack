/**
 * @deprecated Use `instanceof` checks with specific error classes (e.g. `SMWebsocketError`) instead.
 */
export interface CodedError extends Error {
    code: string;
}
/**
 * A dictionary of codes for errors produced by this package
 */
export declare enum ErrorCode {
    SendWhileDisconnectedError = "slack_socket_mode_send_while_disconnected_error",
    SendWhileNotReadyError = "slack_socket_mode_send_while_not_ready_error",
    SendMessagePlatformError = "slack_socket_mode_send_message_platform_error",
    WebsocketError = "slack_socket_mode_websocket_error",
    NoReplyReceivedError = "slack_socket_mode_no_reply_received_error",
    InitializationError = "slack_socket_mode_initialization_error"
}
export type SMCallError = SMPlatformError | SMWebsocketError | SMNoReplyReceivedError | SMSendWhileDisconnectedError | SMSendWhileNotReadyError;
/**
 * The shape of a Slack platform error event that backs an {@link SMPlatformError}.
 */
export interface SMPlatformErrorEvent {
    error: {
        msg: string;
    };
    [key: string]: unknown;
}
export declare abstract class SlackSocketModeError extends Error {
    abstract readonly code: ErrorCode;
    constructor(message: string, options?: ErrorOptions);
}
export declare class SMPlatformError extends SlackSocketModeError {
    readonly code = ErrorCode.SendMessagePlatformError;
    readonly data: SMPlatformErrorEvent;
    constructor(event: SMPlatformErrorEvent);
}
export declare class SMWebsocketError extends SlackSocketModeError {
    readonly code = ErrorCode.WebsocketError;
    readonly original: Error;
    constructor(original: Error);
}
export declare class SMNoReplyReceivedError extends SlackSocketModeError {
    readonly code = ErrorCode.NoReplyReceivedError;
    constructor();
}
export declare class SMSendWhileDisconnectedError extends SlackSocketModeError {
    readonly code = ErrorCode.SendWhileDisconnectedError;
    constructor();
}
export declare class SMSendWhileNotReadyError extends SlackSocketModeError {
    readonly code = ErrorCode.SendWhileNotReadyError;
    constructor();
}
//# sourceMappingURL=errors.d.ts.map