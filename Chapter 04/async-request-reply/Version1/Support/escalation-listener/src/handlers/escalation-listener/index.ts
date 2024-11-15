import { SQSEvent } from "aws-lambda";
import { QueryCommand, DynamoDBClient, QueryCommandInput, BatchWriteItemCommand, BatchWriteItemCommandInput } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async(event: SQSEvent) => {
  console.log(JSON.stringify(event, null, 2));

  await Promise.all(event.Records.map(async(record) => {
    const { body } = record;
    const { category } = JSON.parse(body);

    const query: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
      Limit: 10,
      ScanIndexForward: true,
      KeyConditionExpression: '#PK = :PK and begins_with(#SK, :SK)',
      ExpressionAttributeNames: {
        '#PK': 'PK',
        '#SK': 'SK'
      },
      ExpressionAttributeValues: {
        ':PK': { S: `AVAILABLE` },
        ':SK': { S: `GATEGORY#${category}#ASSIGNMENT#0#` }
      }
    };

    const result = (await client.send(new QueryCommand(query)))?.Items?.[0];
    let assignments = parseInt(result?.assignments.N ?? "0");

    if(!result) {
      console.error(`No AVAILABLE assignment for GATEGORY#${category}#ASSIGNMENT#0# found`);
      return;
    }

    const input : BatchWriteItemCommandInput = {
      RequestItems: {
        [`${process.env.TABLE_NAME}`]: [
          {
            PutRequest: {
              Item: {
                PK: { S: `OCCUPIED` },
                SK: { S: `CATEGORY#${category}#ASSIGNMENT#${++assignments}#${new Date().getTime()}` },
                category: { S: category },
                assignments: { N: `${assignments}`},
                assignedAt: { S: new Date().toISOString() }
              }
            }
          },
          {
            DeleteRequest: {
              Key: {
                PK: result.PK,
                SK: result.SK
              }
            }
          }
        ]
      }
    };
    await client.send(new BatchWriteItemCommand(input));

  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from assignment handler'
    })
  }
};