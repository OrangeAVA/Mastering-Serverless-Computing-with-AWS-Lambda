import "reflect-metadata";
import { container } from "tsyringe";
import { IDatabase } from "../../domain/repositories/database";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamodbRepository, Table } from "../../repositories/dynamodb-repository";
import { ItemService } from "../../domain/services/item-service";
import { CreateItemHandler } from "./create-handler";
import { Item } from "../../domain/entities/item";

container.register<IDatabase<Item>>("IDatabase", {useClass: DynamodbRepository});
container.register(ItemService, {useClass: ItemService});

container.register(Table, {useValue: new Table(process.env.TABLE_NAME!)});
container.register(DynamoDBClient, { useValue: new DynamoDBClient({region: process.env.AWS_REGION })});

const createItemHandler = container.resolve(CreateItemHandler);
export const handler = createItemHandler.Invoke.bind(createItemHandler);