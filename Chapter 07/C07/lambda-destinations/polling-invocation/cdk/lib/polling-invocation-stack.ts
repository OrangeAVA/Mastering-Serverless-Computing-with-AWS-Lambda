import * as cdk from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import { Architecture, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { SqsDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import { KinesisEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { resolve } from 'path';

export class PollingInvocationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    const kisnesisStream = new Stream(this, 'PollingInvocationStream', {});
    const functionRole = new Role(this, 'PollingInvocationFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const lambdaFunction = new NodejsFunction(this, 'PollingInvocationFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/polling-invocation/index.ts`),
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      awsSdkConnectionReuse: false,
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

    new LogGroup(this, 'PollingInvocationFunctionLogGroup', {
      logGroupName: `/aws/lambda/${lambdaFunction.functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const deadLetterQueue = new Queue(this, 'PollingInvocationKinesisFailureDLQueue', {});

    lambdaFunction.addEventSource(new KinesisEventSource(kisnesisStream, {
      onFailure: new SqsDestination(deadLetterQueue),
      startingPosition: StartingPosition.TRIM_HORIZON,
      batchSize: 1,
      retryAttempts: 3,
      maxRecordAge: cdk.Duration.hours(1),
      bisectBatchOnError: true,
    }));

    const kinesisFeederFunction = new NodejsFunction(this, 'PollingInvocationKinesisFeederFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/kinesis-feeder/index.ts`),
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      awsSdkConnectionReuse: false,
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false,
        externalModules: [ '@aws-sdk' ]
      },
      environment: {
        STREAM_ARN: kisnesisStream.streamArn,
        NODE_OPTIONS: '--enable-source-maps',
      }
    });

    new LogGroup(this, 'PollingInvocationKinesisFeederFunctionLogGroup', {
      logGroupName: `/aws/lambda/${kinesisFeederFunction.functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    kisnesisStream.grantWrite(kinesisFeederFunction);
  }
}
