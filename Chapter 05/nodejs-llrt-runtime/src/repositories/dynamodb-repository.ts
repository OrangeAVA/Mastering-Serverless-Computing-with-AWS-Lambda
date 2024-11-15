//@ts-nocheck 
import { IDatabase } from "../domain/repositories/database";
import { Item } from "../domain/entities/item";
import { inject, injectable } from "tsyringe";
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

@injectable()
export class Table {
  constructor(public readonly name: string) {}
}

@injectable()
export class DynamodbRepository implements IDatabase {
  constructor(
    @inject(Table) private readonly table: Table,
    @inject(DynamoDBClient) private readonly client: DynamoDBClient) {}

  Save = async (model: Item): Promise<Item> => {
    await this.client.send(new PutItemCommand({
      TableName: this.table.name,
      Item: marshall(model, { convertClassInstanceToMap: true })
    })) ?? {};
    return model;
  }
  Find = async (id: string): Promise<Item> => {
    const item = await this.client.send(new GetItemCommand({
      TableName: this.table.name,
      Key: {
        id: { S: id },
      }
    }));
    return item.Item ? unmarshall(item.Item) as Item : null;
  }
}