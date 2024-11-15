import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ChangeMessageVisibilityCommand, SQSClient } from "@aws-sdk/client-sqs";
import { marshall } from "@aws-sdk/util-dynamodb";
import { SQSEvent, SQSRecord } from "aws-lambda";
import { nanoid } from "nanoid";
import { EnrichService } from "./enrich-service";

const ddbclient = new DynamoDBClient({ region: process.env.AWS_REGION});
const sqsclient = new SQSClient({ region: process.env.AWS_REGION});
const MaxAttempts = 3;
const enrichService = new EnrichService();

const GetDuration = (record: SQSRecord, base: number) => {
  const backoffrate = 2.5;
  return  parseInt(record.attributes.ApproximateReceiveCount) * backoffrate * base;
}

const changeVisibiliotyTimeout = async (record: SQSRecord) => {
  const VisibilityTimeout = GetDuration(record, 30);
  console.log(`Changing visibility timeout to ${VisibilityTimeout}`);

  const changeVisibilityTimeoutCommandInput = {
    QueueUrl: process.env.QUEUE_URL,
    ReceiptHandle: record.receiptHandle,
    VisibilityTimeout: VisibilityTimeout
  };
  
  await sqsclient.send(new ChangeMessageVisibilityCommand(changeVisibilityTimeoutCommandInput));
  return VisibilityTimeout;
}

const HandleArticle = async (record: SQSRecord) => {
  const enrichAndSave = async(record: SQSRecord) => {
    const article = JSON.parse(record.body);
    await enrichService.Enrich(article);

    const putItemCommand = new PutItemCommand({
      TableName: process.env.TABLE_NAME,
      Item: marshall({ ...article, date: new Date().toISOString(), id: nanoid() }),
    });

    await ddbclient.send(putItemCommand);
  }

  try {
    await enrichAndSave(record);
  } catch (error) {
    const attempts = parseInt(record.attributes.ApproximateReceiveCount ?? "0");
    if( attempts >= MaxAttempts )
      throw error;

    record.attributes.ApproximateReceiveCount = (attempts + 1).toString();
    await changeVisibiliotyTimeout(record);
    await new Promise( _ => setTimeout(async () => { await HandleArticle(record); }, GetDuration(record, 15000)));
  }
}

const enrichArticle = async (event: SQSEvent) => {
  await Promise.all(event.Records.map(async (record: SQSRecord) => {
    await HandleArticle(record);
  }));
  
  return {
    statusCode: 201
  };
}

export const handler = enrichArticle;
