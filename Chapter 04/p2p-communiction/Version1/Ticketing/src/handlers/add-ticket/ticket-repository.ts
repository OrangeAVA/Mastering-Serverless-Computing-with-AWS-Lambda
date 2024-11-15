import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from "@aws-sdk/client-dynamodb";

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
      }
    } satisfies PutItemCommandInput;

    await this.client.send(new PutItemCommand(input));
  }
}
