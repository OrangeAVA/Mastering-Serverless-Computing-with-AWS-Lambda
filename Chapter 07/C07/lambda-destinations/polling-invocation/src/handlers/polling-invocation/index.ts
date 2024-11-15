import { KinesisStreamEvent } from "aws-lambda";

export class ItemNotFoundException extends Error {
  private static readonly defaultMessage = "Item not found";
  constructor(message?: string) {
      super(message ?? ItemNotFoundException.defaultMessage);
      this.name = "ItemNotFound";
  }
}
export const handler = async(event: KinesisStreamEvent) => {
  console.log("Event: ", JSON.stringify(event, null, 2));
  throw new ItemNotFoundException();
};