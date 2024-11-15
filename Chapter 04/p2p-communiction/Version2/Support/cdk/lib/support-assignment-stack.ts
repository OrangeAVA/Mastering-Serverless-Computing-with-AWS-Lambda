import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { DeduplicationScope, Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { resolve } from 'path';


export class SupportAssignmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const functionRole = new Role(this, 'AssignmentFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const table = new Table(this, 'AssignmentTable', {
      tableName: 'assignment-table',
      partitionKey: {
        name: 'PK',
        type: AttributeType .STRING
      },
      sortKey: {
        name: 'SK',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: StreamViewType.NEW_IMAGE,
    });

    const deadLetterQueue = new Queue(this, 'AssignmentDeadLetterQueue', {
      queueName: 'assignment-dead-letter-queue.fifo',
      fifo: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
    });

    const queue = new Queue(this, 'AssignmentIncomingDemandsQueue', {
      queueName: 'assignment-incoming-demands-queue.fifo',
      fifo: true,
      visibilityTimeout: cdk.Duration.seconds(300),
      deduplicationScope: DeduplicationScope.QUEUE,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3
      }
    });
    
    const functionName = `assignment-function`;
    const logGroup = new LogGroup(this, 'AssignmentFunctionLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const assignmentFunction = new NodejsFunction(this, 'AssignmentFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/assignment/index.ts`),
      functionName: functionName,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      logGroup: logGroup,
      handler: 'handler',
      bundling: {
        minify: true,
        externalModules: [ '@aws-sdk/client-dynamodb' ]
      },
      environment: {
        TABLE_NAME: table.tableName,
      }
    });

    assignmentFunction.addEventSource(new SqsEventSource(queue, {
      enabled: true,
    }));

    new StringParameter(this, 'AssignmentIncommingQueueArnParameter', {
      parameterName: '/assignment/queue/arn',
      stringValue: queue.queueArn
    });

    table.grantReadWriteData(functionRole);
    deadLetterQueue.grantSendMessages(functionRole);
    queue.grantConsumeMessages(functionRole);
  }
}
