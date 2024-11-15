import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from "@aws-sdk/client-dynamodb";

export class ItemRepository {
  constructor(private readonly client: DynamoDBClient) {}

  addItem = async (name: string, id: string) => {
    const input = {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: { S: `${id}` },
        name: { S: name },
        createdAt: { S: new Date().toISOString() }
      }
    } satisfies PutItemCommandInput;

    await this.client.send(new PutItemCommand(input));
  }
}
