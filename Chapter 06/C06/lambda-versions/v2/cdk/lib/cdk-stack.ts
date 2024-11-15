import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function, Runtime, Version } from 'aws-cdk-lib/aws-lambda';
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
      logGroupName: `/aws/lambda/${Function.name}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });

    const createItemFunction = new NodejsFunction(this, `CreateItemFunction`, {
      entry: resolve(__dirname, '../../src/node/handlers/create-item.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      logGroup: createItemFunctionLogGroup,
      memorySize: 256,
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
    });
    
    // const createItemFunction = new Function(this, `CreateItemFunction`, {
    //   code: Code.fromAsset(resolve(__dirname, '../../src/python/handlers/create-item')),
    //   handler: 'handler',
    //   runtime: Runtime.PYTHON_3_12,
    //   architecture: Architecture.ARM_64,
    //   logGroup: createItemFunctionLogGroup,
    //   memorySize: 256,
    //   timeout: Duration.seconds(15),
    //   role: functionRole,
    // });

    new Version(this, 'CreateItemFunctionVersion', {
      lambda: createItemFunction,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // new Version(this, 'CreateItemFunctionVersion2', {
    //   lambda: createItemFunction,
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });

    // new Version(this, 'CreateItemFunctionVersion3', {
    //   lambda: createItemFunction,
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });
  }
}
