"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationError = exports.UnknownError = exports.MissingCodeError = exports.InvalidStateError = exports.MissingStateError = exports.GenerateInstallUrlError = exports.InstallerInitializationError = exports.SlackOAuthError = exports.ErrorCode = void 0;
/**
 * A dictionary of codes for errors produced by this package.
 */
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["InstallerInitializationError"] = "slack_oauth_installer_initialization_error";
    ErrorCode["AuthorizationError"] = "slack_oauth_installer_authorization_error";
    ErrorCode["GenerateInstallUrlError"] = "slack_oauth_generate_url_error";
    ErrorCode["MissingStateError"] = "slack_oauth_missing_state";
    ErrorCode["InvalidStateError"] = "slack_oauth_invalid_state";
    ErrorCode["MissingCodeError"] = "slack_oauth_missing_code";
    ErrorCode["UnknownError"] = "slack_oauth_unknown_error";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
class SlackOAuthError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.SlackOAuthError = SlackOAuthError;
class InstallerInitializationError extends SlackOAuthError {
    code = ErrorCode.InstallerInitializationError;
}
exports.InstallerInitializationError = InstallerInitializationError;
class GenerateInstallUrlError extends SlackOAuthError {
    code = ErrorCode.GenerateInstallUrlError;
}
exports.GenerateInstallUrlError = GenerateInstallUrlError;
class MissingStateError extends SlackOAuthError {
    code = ErrorCode.MissingStateError;
}
exports.MissingStateError = MissingStateError;
class InvalidStateError extends SlackOAuthError {
    code = ErrorCode.InvalidStateError;
}
exports.InvalidStateError = InvalidStateError;
class MissingCodeError extends SlackOAuthError {
    code = ErrorCode.MissingCodeError;
}
exports.MissingCodeError = MissingCodeError;
class UnknownError extends SlackOAuthError {
    code = ErrorCode.UnknownError;
}
exports.UnknownError = UnknownError;
class AuthorizationError extends SlackOAuthError {
    code = ErrorCode.AuthorizationError;
    original;
    constructor(message, original) {
        super(message, original !== undefined ? { cause: original } : undefined);
        if (original !== undefined) {
            this.original = original;
        }
    }
}
exports.AuthorizationError = AuthorizationError;
//# sourceMappingURL=errors.js.map