export class NotOwnedError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotOwnedError";
  }
}
