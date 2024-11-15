import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Architecture, FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda';

import { LlrtFunction } from './constructs/llrt-function';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { resolve } from 'path';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { LogGroup } from 'aws-cdk-lib/aws-logs';

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new Table(this, 'ItemsTable', {
      partitionKey: { 
        name: 'id', 
        type: AttributeType.STRING
      },
    });
    const functionRole = new Role(this, 'AddRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const nodejsLogGroup = new LogGroup(this, `${NodejsFunction.name}-LogGroup`, {
      logGroupName: `/aws/lambda/${NodejsFunction.name}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });

    const nodejsFunction = new NodejsFunction(this, `${NodejsFunction.name}-CreateItemFunction`, {
      entry: resolve(__dirname, '../../handlers/create-item/index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      logGroup: nodejsLogGroup,
      bundling: {
        platform: 'neutral',
        format: OutputFormat.ESM,
        minify: false,
        sourceMap: true,
        sourcesContent: false,
        mainFields: ['module', 'main'],
        metafile: true, // this is used for bundle analysis and is not needed for production
        externalModules: ['@aws-sdk'],
      },
      environment: {
        TABLE_NAME: table.tableName
      },
    });
    const nodejsUrl = nodejsFunction.addFunctionUrl({ 
      authType: FunctionUrlAuthType.NONE
    });
    nodejsUrl.grantInvokeUrl(functionRole);

    const llrtLogGroup = new LogGroup(this, `${LlrtFunction.name}-LogGroup`, {
      logGroupName: `/aws/lambda/${LlrtFunction.name}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });
    const llrtFunction = new LlrtFunction(this, `${LlrtFunction.name}-CreateItemFunction`, {
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      entry: '../handlers/create-item/index.ts',
      logGroup: llrtLogGroup,
      environment: {
        TABLE_NAME: table.tableName
      }
    });

    const llrtUrl = llrtFunction.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE
    });
    llrtUrl.grantInvokeUrl(functionRole);


    table.grantReadWriteData(nodejsFunction);
    table.grantReadWriteData(llrtFunction);
  }
}
