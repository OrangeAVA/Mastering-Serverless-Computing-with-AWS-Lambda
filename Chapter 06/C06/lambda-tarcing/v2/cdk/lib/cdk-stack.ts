import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { resolve } from 'path';
export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const resourceNamePrefix = 'CreateItemExample';
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

    const queue = new Queue(this, 'Queue', {
      visibilityTimeout: Duration.seconds(30),
      queueName: `${resourceNamePrefix}-Queue`,
    });

    const table = new Table(this, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      tableName: `${resourceNamePrefix}-Table`,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const createItemFunction = new NodejsFunction(this, `CreateItemFunction`, {
      functionName: `${resourceNamePrefix}-Function`,
      entry: resolve(__dirname, '../../src/handlers/create-item.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      logGroup: createItemFunctionLogGroup,
      memorySize: 256,
      timeout: Duration.seconds(15),
      role: functionRole,
      tracing: Tracing.ACTIVE,
      bundling: {
        platform: 'node',
        minify: false,
        sourceMap: true,
        sourcesContent: false,
        externalModules: ['@aws-sdk'],
      },
      environment: {
        ITEM_TABLE_NAME: table.tableName,
      },
    });

    createItemFunction.addEventSource(new SqsEventSource(queue));
    queue.grantConsumeMessages(functionRole);
    table.grantWriteData(functionRole);
  }
}
