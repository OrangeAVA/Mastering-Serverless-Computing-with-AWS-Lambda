import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ItemRepository } from "./item-repository";

const repository = new ItemRepository(new DynamoDBClient({ region: process.env.AWS_REGION }));
export const handler = async(event: APIGatewayProxyEvent) => {
  
    try {
        const { name, id } = JSON.parse(event.body ?? '{}');
        await repository.addItem(name, id)
        return {
          statusCode: 201,
          body: JSON.stringify({
            message: 'Hello from Add Item handler'
          })
        }
    } catch (error) {
      console.error('Error: ', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Internal Server Error'
        })
    }
  }
};
