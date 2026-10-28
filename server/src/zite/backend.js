// Minimal replacements for the helpers the endpoint files use.
export function createEndpoint(config) {
  return config;
}

const STATUS = { UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, BAD_REQUEST: 400, RATE_LIMITED: 429 };

export class ZiteError extends Error {
  constructor(arg, status) {
    if (typeof arg === 'string') {
      super(arg);
      this.code = 'ERROR';
      this.userFacingMessage = arg;
      this.status = typeof status === 'number' ? status : 500;
      return;
    }
    const { code = 'INTERNAL', message, userFacingMessage } = arg || {};
    super(message || userFacingMessage || code);
    this.code = code;
    this.userFacingMessage = userFacingMessage;
    this.status = STATUS[code] || (typeof status === 'number' ? status : 500);
  }
}
