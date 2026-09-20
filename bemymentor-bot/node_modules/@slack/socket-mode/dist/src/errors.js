"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSendWhileNotReadyError = exports.SMSendWhileDisconnectedError = exports.SMNoReplyReceivedError = exports.SMWebsocketError = exports.SMPlatformError = exports.SlackSocketModeError = exports.ErrorCode = void 0;
/**
 * A dictionary of codes for errors produced by this package
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["SendWhileDisconnectedError"] = "slack_socket_mode_send_while_disconnected_error";
    ErrorCode["SendWhileNotReadyError"] = "slack_socket_mode_send_while_not_ready_error";
    ErrorCode["SendMessagePlatformError"] = "slack_socket_mode_send_message_platform_error";
    ErrorCode["WebsocketError"] = "slack_socket_mode_websocket_error";
    ErrorCode["NoReplyReceivedError"] = "slack_socket_mode_no_reply_received_error";
    ErrorCode["InitializationError"] = "slack_socket_mode_initialization_error";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class SlackSocketModeError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.SlackSocketModeError = SlackSocketModeError;
class SMPlatformError extends SlackSocketModeError {
    code = ErrorCode.SendMessagePlatformError;
    data;
    constructor(event) {
        super(`An API error occurred: ${event.error.msg}`);
        this.data = event;
    }
}
exports.SMPlatformError = SMPlatformError;
class SMWebsocketError extends SlackSocketModeError {
    code = ErrorCode.WebsocketError;
    original;
    constructor(original) {
        super(original.message, { cause: original });
        this.original = original;
    }
}
exports.SMWebsocketError = SMWebsocketError;
class SMNoReplyReceivedError extends SlackSocketModeError {
    code = ErrorCode.NoReplyReceivedError;
    constructor() {
        super('Message sent but no server acknowledgement was received. This may be caused by the client ' +
            'changing connection state rather than any issue with the specific message. Check before resending.');
    }
}
exports.SMNoReplyReceivedError = SMNoReplyReceivedError;
class SMSendWhileDisconnectedError extends SlackSocketModeError {
    code = ErrorCode.SendWhileDisconnectedError;
    constructor() {
        super('Failed to send a WebSocket message as the client is not connected');
    }
}
exports.SMSendWhileDisconnectedError = SMSendWhileDisconnectedError;
class SMSendWhileNotReadyError extends SlackSocketModeError {
    code = ErrorCode.SendWhileNotReadyError;
    constructor() {
        super('Failed to send a WebSocket message as the client is not ready');
    }
}
exports.SMSendWhileNotReadyError = SMSendWhileNotReadyError;
//# sourceMappingURL=errors.js.map