import { SQSEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { captureAWSv3Client } from 'aws-xray-sdk-core';

const client = captureAWSv3Client(
  new SNSClient({ region: process.env.AWS_REGION })
);
export const handler = async (event: SQSEvent): Promise<any> => {
  const item = {
    id: "123456778888",
    name: "serverless",
  };

  await client.send(new PublishCommand({
    TopicArn: process.env.TOPIC_ARN,
    Message: JSON.stringify(item),
  }));
  
  return {
    statusCode: 200,
    body: JSON.stringify('Hello from create item!'),
  };
}