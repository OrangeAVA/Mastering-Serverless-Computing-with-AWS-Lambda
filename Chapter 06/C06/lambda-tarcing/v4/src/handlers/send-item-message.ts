import { Context, SNSEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { LambdaInterface } from '@aws-lambda-powertools/commons';


const tracer = new Tracer({ serviceName: 'serverlessAirline' });
const client = tracer.captureAWSv3Client(new SQSClient({ region: process.env.AWS_REGION } ));

class Handler implements LambdaInterface {
  // Decorate your handler class method
  @tracer.captureLambdaHandler()
  public async handler(event: SNSEvent, context: Context): Promise<any> {
    tracer.getSegment();
    await client.send(new SendMessageCommand({
      QueueUrl: process.env.QUEUE_NAME,
      MessageBody: JSON.stringify(JSON.parse(event.Records[0].Sns.Message))
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify('Hello from create item!'),
    };
  }
}

const handlerClass = new Handler();
export const handler = handlerClass.handler.bind(handlerClass);
