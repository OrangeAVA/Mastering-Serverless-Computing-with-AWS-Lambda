import { SQSEvent } from 'aws-lambda';
export const handler = async (event: SQSEvent = {}): Promise<any> => {
  console.log('event', event);
  return {
    statusCode: 200,
    body: JSON.stringify('Hello from create item!'),
  };
}