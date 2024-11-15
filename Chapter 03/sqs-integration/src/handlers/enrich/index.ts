import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { nanoid } from "nanoid";

const client = new DynamoDBClient({ region: process.env.AWS_REGION});

const Wait = () => new Promise(resolve => setTimeout(resolve, 9000));

const enrichArticle = async (event: SQSEvent) => {
  await Promise.all(event.Records.map(async (record: SQSRecord) => {
    const article = JSON.parse(record.body);
    const putItemCommand = new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({ ...article, date: new Date().toISOString(), id: nanoid() }),
    });
    
    await client.send(putItemCommand);
  }));
  
  return {
    statusCode: 201
  };
}


export const handlerWithWait = async(event: SQSEvent) => {
  await Wait();
  enrichArticle(event);
};

export const handler = enrichArticle;
