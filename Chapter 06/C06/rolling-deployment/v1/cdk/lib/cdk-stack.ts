import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { resolve } from 'path';
import { Deployment  } from './deployment';
import { LambdaDeploymentConfig } from 'aws-cdk-lib/aws-codedeploy';
export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const functionName = `CreateItem-Function`;
    const functionRole = new Role(this, 'AddRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        
      ]
    });

    const createItemFunctionLogGroup = new LogGroup(this, `CreateItemLogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });

    const createItemFunction = new NodejsFunction(this, `CreateItemFunction`, {
      functionName,
      entry: resolve(__dirname, '../../src/node/handlers/create-item.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      logGroup: createItemFunctionLogGroup,
      memorySize: 128,
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
        description: `current Version at ${new Date().toISOString()}`,
      }
    });

    const alias = createItemFunction.addAlias('live');
    new Deployment(this, 'Lambda Deployment', {
      alias,
      deploymentConfig: LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE
    });
  }
}
