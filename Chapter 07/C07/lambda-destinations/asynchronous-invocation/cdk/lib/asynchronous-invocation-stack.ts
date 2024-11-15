import * as cdk from 'aws-cdk-lib';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { resolve } from 'path';

export class AsynchronousInvocationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const topic = new Topic(this, 'AsynchronousInvocationTopic', {});
    const subscriptionDeadLetterQueue = new Queue(this, 'subscription-dead-letter-queue', { });

    subscriptionDeadLetterQueue.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [ 'SQS:SendMessage'],
      principals: [ new ServicePrincipal('sns.amazonaws.com')],
      conditions: {
        'ArnEquals': {
          'aws:SourceArn': topic.topicArn
        }
      }
    }));

    const functionRole = new Role(this, 'AsynchronousInvocationFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const functionName = `asynchronous-invocation-function`;
    const logGroup = new LogGroup(this, 'AsynchronousInvocationFunctionLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const lambdaFunction = new NodejsFunction(this, 'AsynchronousInvocationFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/asynchronous-invocation/index.ts`),
      functionName: functionName,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      awsSdkConnectionReuse: false,
      onFailure: new SqsDestination(new Queue(this, 'AsynchronousInvocationFunctionFailureQueue', {})),
      onSuccess: new SqsDestination(new Queue(this, 'AsynchronousInvocationFunctionSucessQueue', {})),
      logGroup: logGroup,
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


    topic.addSubscription(new LambdaSubscription(lambdaFunction, {}))

  }
}
