"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySigningSecret = void 0;
const errors_1 = require("../errors");
function verifySigningSecret(signingSecret, signatureVerification) {
    if (signatureVerification && !signingSecret) {
        throw new errors_1.AppInitializationError('signingSecret is required when signature verification is enabled. ' +
            'You can find your Signing Secret in your Slack App Settings.');
    }
}
exports.verifySigningSecret = verifySigningSecret;
//# sourceMappingURL=verify-signing-secret.js.map