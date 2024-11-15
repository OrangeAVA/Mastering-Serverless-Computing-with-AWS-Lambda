export type InternalException = any | unknown;

export class TicketAlreadyExistException extends Error {
  constructor(ticketId: string) {
    super(`The ticket ${ticketId} already exists`);
  }
}