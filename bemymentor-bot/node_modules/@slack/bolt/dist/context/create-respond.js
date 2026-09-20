"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRespond = void 0;
const errors_1 = require("../errors");
function createRespond(fetchFn, responseUrl) {
    return async (message) => {
        const normalizedArgs = typeof message === 'string' ? { text: message } : message;
        const response = await fetchFn(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalizedArgs),
        });
        // fetch resolves regardless of status code.
        // Throw so that failures (e.g. expired response_url, rate limits) reach the app's error handling.
        if (!response.ok) {
            throw new errors_1.RespondError(`Failed to respond to the response_url: ${response.status} ${response.statusText}`, response.status);
        }
        return response;
    };
}
exports.createRespond = createRespond;
//# sourceMappingURL=create-respond.js.map