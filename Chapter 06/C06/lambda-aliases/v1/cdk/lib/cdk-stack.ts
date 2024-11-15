import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Version } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { resolve } from 'path';
export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const functionRole = new Role(this, 'AddRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const createItemFunctionLogGroup = new LogGroup(this, `CreateItemLogGroup`, {
      logGroupName: `/aws/lambda/${NodejsFunction.name}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });

    const createItemFunction = new NodejsFunction(this, `CreateItemFunction`, {
      entry: resolve(__dirname, '../../src/node/handlers/create-item.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      logGroup: createItemFunctionLogGroup,
      memorySize: 512,
      timeout: Duration.seconds(15),
      role: functionRole,
      bundling: {
        platform: 'neutral',
        format: OutputFormat.ESM,
        minify: false,
        sourceMap: true,
        sourcesContent: false,
        mainFields: ['module', 'main'],
        metafile: true,
        externalModules: ['@aws-sdk'],
      },
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
      }
    });

    createItemFunction.addAlias('live');
  }
}
