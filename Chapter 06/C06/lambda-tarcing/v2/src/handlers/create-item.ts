import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { captureAWSv3Client } from 'aws-xray-sdk-core';

const ddbClient = captureAWSv3Client(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);
export const handler = async (event: SQSEvent): Promise<any> => {

  await Promise.all(event.Records.map(async (record) => {
    const payload = JSON.parse(record.body);
    const item = {
      id: payload.id,
      name: payload.name,
    };

    await ddbClient.send(new PutItemCommand({
      TableName: process.env.ITEM_TABLE_NAME,
      Item: marshall(item),
    }));
  }));
  
  return {
    statusCode: 200,
    body: JSON.stringify('Hello from create item!'),
  };
}