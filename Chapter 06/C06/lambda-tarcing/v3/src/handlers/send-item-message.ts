import { SNSEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { captureAWSv3Client } from 'aws-xray-sdk-core';

const client = captureAWSv3Client(
  new SQSClient({ region: process.env.AWS_REGION })
);
export const handler = async (event: SNSEvent): Promise<any> => {
  await client.send(new SendMessageCommand({
    QueueUrl: process.env.QUEUE_NAME,
    MessageBody: JSON.stringify(JSON.parse(event.Records[0].Sns.Message))
  }));
  
  return {
    statusCode: 200,
    body: JSON.stringify('Hello from create item!'),
  };
}