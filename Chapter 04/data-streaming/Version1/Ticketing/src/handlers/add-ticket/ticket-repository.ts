import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from "@aws-sdk/client-dynamodb";
import { InternalException, TicketAlreadyExistException } from "./exception";

export class TicketRepository {
  constructor(private readonly client: DynamoDBClient) {}

  createTicket = async (category: string, ticketId: string, message: string) => {
    const input = {
      TableName: process.env.TABLE_NAME,
      Item: {
        ticketId: { S: `${ticketId}` },
        category: { S: category },
        message: { S: message },
        createdAt: { S: new Date().toISOString() }
      },
      ConditionExpression: "attribute_not_exists(ticketId)",
    } satisfies PutItemCommandInput;

    try {
      await this.client.send(new PutItemCommand(input));
    } catch (error: InternalException) {
        if (error.name === 'ConditionalCheckFailedException') {
          throw new TicketAlreadyExistException(ticketId);
        }
        throw error;
    }
  }
}
