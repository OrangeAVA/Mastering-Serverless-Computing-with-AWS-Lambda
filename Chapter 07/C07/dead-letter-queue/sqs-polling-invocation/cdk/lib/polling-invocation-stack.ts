import * as cdk from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { resolve } from 'path';

export class SQSPollingInvocationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const deadLetterQueue = new Queue(this, 'subscription-dead-letter-queue', { });
    const queue = new Queue(this, 'SQSPollingInvocationTopic', {
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue
      }
    });

    const functionRole = new Role(this, 'SQSPollingInvocationFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const lambdaFunction = new NodejsFunction(this, 'SQSPollingInvocationFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/polling-invocation/index.ts`),
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      awsSdkConnectionReuse: false,
      onFailure: new SqsDestination(new Queue(this, 'SQSPollingInvocationFunctionFailureQueue', {})),
      onSuccess: new SqsDestination(new Queue(this, 'SQSPollingInvocationFunctionSucessQueue', {})),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false,
        externalModules: [ '@aws-sdk' ]
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      }
    });

    new LogGroup(this, 'SQSPollingInvocationFunctionLogGroup', {
      logGroupName: `/aws/lambda/${lambdaFunction.functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    deadLetterQueue.grantSendMessages(lambdaFunction);
    queue.grantConsumeMessages(lambdaFunction);

    lambdaFunction.addEventSource(new SqsEventSource(queue, {
      batchSize: 10,
    }));

  }
}
