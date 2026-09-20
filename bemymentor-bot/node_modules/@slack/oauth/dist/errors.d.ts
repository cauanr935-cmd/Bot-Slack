/**
 * All errors produced by this package adhere to this interface.
 *
 * NOTE: This interface is retained because it is part of the public `CallbackOptions#failure`
 * callback signature. For new code, prefer `instanceof` checks against the {@link SlackOAuthError}
 * base class or a specific error subclass.
 */
export interface CodedError extends Error {
    code: string;
}
/**
 * A dictionary of codes for errors produced by this package.
 */
export declare enum ErrorCode {
    InstallerInitializationError = "slack_oauth_installer_initialization_error",
    AuthorizationError = "slack_oauth_installer_authorization_error",
    GenerateInstallUrlError = "slack_oauth_generate_url_error",
    MissingStateError = "slack_oauth_missing_state",
    InvalidStateError = "slack_oauth_invalid_state",
    MissingCodeError = "slack_oauth_missing_code",
    UnknownError = "slack_oauth_unknown_error"
}
export declare abstract class SlackOAuthError extends Error {
    abstract readonly code: ErrorCode;
    constructor(message: string, options?: ErrorOptions);
}
export declare class InstallerInitializationError extends SlackOAuthError {
    readonly code = ErrorCode.InstallerInitializationError;
}
export declare class GenerateInstallUrlError extends SlackOAuthError {
    readonly code = ErrorCode.GenerateInstallUrlError;
}
export declare class MissingStateError extends SlackOAuthError {
    readonly code = ErrorCode.MissingStateError;
}
export declare class InvalidStateError extends SlackOAuthError {
    readonly code = ErrorCode.InvalidStateError;
}
export declare class MissingCodeError extends SlackOAuthError {
    readonly code = ErrorCode.MissingCodeError;
}
export declare class UnknownError extends SlackOAuthError {
    readonly code = ErrorCode.UnknownError;
}
export declare class AuthorizationError extends SlackOAuthError {
    readonly code = ErrorCode.AuthorizationError;
    original: Error | undefined;
    constructor(message: string, original?: Error);
}
//# sourceMappingURL=errors.d.ts.map