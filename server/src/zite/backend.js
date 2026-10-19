// Minimal replacements for the helpers the endpoint files use.
export function createEndpoint(config) {
  return config;
}

const STATUS = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, BAD_REQUEST: 400, RATE_LIMITED: 429 };

export class ZiteError extends Error {
  constructor({ code = 'INTERNAL', message, userFacingMessage } = {}) {
    super(message || userFacingMessage || code);
    this.code = code;
    this.userFacingMessage = userFacingMessage;
    this.status = STATUS[code] || 500;
  }
}
