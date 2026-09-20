"use strict";
/// <reference lib="es2017" />
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnrecoverableSocketModeStartError = exports.SocketModeClient = exports.LogLevel = exports.SMWebsocketError = exports.SMSendWhileNotReadyError = exports.SMSendWhileDisconnectedError = exports.SMPlatformError = exports.SMNoReplyReceivedError = exports.SlackSocketModeError = exports.ErrorCode = void 0;
var errors_1 = require("./errors");
Object.defineProperty(exports, "ErrorCode", { enumerable: true, get: function () { return errors_1.ErrorCode; } });
Object.defineProperty(exports, "SlackSocketModeError", { enumerable: true, get: function () { return errors_1.SlackSocketModeError; } });
Object.defineProperty(exports, "SMNoReplyReceivedError", { enumerable: true, get: function () { return errors_1.SMNoReplyReceivedError; } });
Object.defineProperty(exports, "SMPlatformError", { enumerable: true, get: function () { return errors_1.SMPlatformError; } });
Object.defineProperty(exports, "SMSendWhileDisconnectedError", { enumerable: true, get: function () { return errors_1.SMSendWhileDisconnectedError; } });
Object.defineProperty(exports, "SMSendWhileNotReadyError", { enumerable: true, get: function () { return errors_1.SMSendWhileNotReadyError; } });
Object.defineProperty(exports, "SMWebsocketError", { enumerable: true, get: function () { return errors_1.SMWebsocketError; } });
var logger_1 = require("./logger");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return logger_1.LogLevel; } });
var SocketModeClient_1 = require("./SocketModeClient");
Object.defineProperty(exports, "SocketModeClient", { enumerable: true, get: function () { return SocketModeClient_1.SocketModeClient; } });
var UnrecoverableSocketModeStartError_1 = require("./UnrecoverableSocketModeStartError");
Object.defineProperty(exports, "UnrecoverableSocketModeStartError", { enumerable: true, get: function () { return UnrecoverableSocketModeStartError_1.UnrecoverableSocketModeStartError; } });
//# sourceMappingURL=index.js.map