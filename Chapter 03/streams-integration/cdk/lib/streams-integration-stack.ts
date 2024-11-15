import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { resolve } from 'path';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { KinesisEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Stream, StreamMode } from 'aws-cdk-lib/aws-kinesis';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export class StreamIntegrationStack extends Stack {
  private static readonly handlersPath = 'src/handlers';

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const role = new Role(this, 'send-logs-function-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const kinesisDataStream = new Stream(this, 'logs-stream', {
      shardCount: 1,
      streamMode: StreamMode.PROVISIONED,
      streamName: 'logs-stream'
    });

    kinesisDataStream.grantRead(role);

    const sendLogsFunction = new NodejsFunction(this, 'send-logs-function', {
      role,
      entry: resolve(`${StreamIntegrationStack.handlersPath}/send-logs/index.ts`),
      functionName: `send-logs-function`,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      handler: 'handler',
      bundling: {
        sourceMap: false 
      },
    });

    const deadletterqueue = new Queue(this, 'dead-letter-queue', {
      queueName: 'dead-letter-queue'
    });

    deadletterqueue.grantSendMessages(role);

    sendLogsFunction.addEventSource(new KinesisEventSource(kinesisDataStream, { 
      startingPosition: StartingPosition.LATEST,
      enabled: true,
      onFailure: new SqsDlq(deadletterqueue),
      retryAttempts: 3
    }));
  }
}