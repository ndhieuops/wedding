/** HTTP error with a Vietnamese message that is safe to show to end users. */
export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.expose = true;
  }
}
