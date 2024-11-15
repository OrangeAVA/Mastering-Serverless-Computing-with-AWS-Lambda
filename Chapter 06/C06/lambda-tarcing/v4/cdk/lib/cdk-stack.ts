import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { resolve } from 'path';
export class ItemsExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const functionRole = new Role(this, 'AddRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    const fuctionParams = {
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
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
      }
    };

    const table = new Table(this, 'ItemsTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      tableName: `${this.stackName}-item-table`,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const createItemFunctionLogGroup = new LogGroup(this, `CreateItemLogGroup`, {
      logGroupName: `/aws/lambda/${this.stackName}-create-item-function`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });
    const createItemFunction = new NodejsFunction(this, `CreateItemFunction`, {
      functionName: `${this.stackName}-create-item-function`,
      entry: resolve(__dirname, '../../src/handlers/create-item.ts'),
      logGroup: createItemFunctionLogGroup,
      environment: {
        ITEM_TABLE_NAME: table.tableName,
      },
      ...fuctionParams
    });


    const queue = new Queue(this, 'Queue', {
      visibilityTimeout: Duration.seconds(30),
      queueName: `${this.stackName}-item-queue`,
    });
    const sendMessageFunctionLogGroup = new LogGroup(this, `SendItemMessageLogGroup`, {
      logGroupName: `/aws/lambda/${this.stackName}-send-item-function`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });
    const sendMessageFunction = new NodejsFunction(this, `SendItemMessageFunction`, {
      functionName: `${this.stackName}-send-item-function`,
      entry: resolve(__dirname, '../../src/handlers/send-item-message.ts'),
      logGroup: sendMessageFunctionLogGroup,
      environment: {
        QUEUE_NAME: queue.queueName,
      },
      ...fuctionParams
    });

    const topic = new Topic(this, 'ItemTopic', {
      topicName: `${this.stackName}-item-topic`,
    });
    const publisMessageFunctionLogGroup = new LogGroup(this, `PublishItemMessageLogGroup`, {
      logGroupName: `/aws/lambda/${this.stackName}-publish-item-function`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: 1
    });
    new NodejsFunction(this, `PublishItemMessageFunction`, {
      functionName: `${this.stackName}-publish-item-function`,
      entry: resolve(__dirname, '../../src/handlers/publish-item-message.ts'),
      logGroup: publisMessageFunctionLogGroup,
      environment: {
        TOPIC_ARN: topic.topicArn,
      },
      ...fuctionParams
    });

    topic.addSubscription(new LambdaSubscription(sendMessageFunction))
    topic.grantPublish(createItemFunction);

    createItemFunction.addEventSource(new SqsEventSource(queue));
    queue.grantConsumeMessages(functionRole);
    queue.grantSendMessages(functionRole);
    table.grantWriteData(functionRole);
  }
}
