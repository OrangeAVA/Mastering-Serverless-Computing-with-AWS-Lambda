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
    const payload = JSON.parse(event.Records[0].Sns.Message);
    
    await this.StepOne();
    
    if(payload.name === 'serverless') {
      await this.StepTwo();
    } else {
      await this.StepThree();
    }

    await this.StepFour();

    await client.send(new SendMessageCommand({
      QueueUrl: process.env.QUEUE_NAME,
      MessageBody: JSON.stringify(payload)
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify('Hello from create item!'),
    };
  }

  async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  @tracer.captureMethod()
  async StepOne() {
    await this.sleep(100);
  }

  @tracer.captureMethod()
  async StepTwo() {
    await this.sleep(200);
  }

  @tracer.captureMethod()
  async StepThree() {
    await this.sleep(300)
  }

  @tracer.captureMethod()
  async StepFour() {
    await this.sleep(400)
  }

}

const handlerClass = new Handler();
export const handler = handlerClass.handler.bind(handlerClass);
