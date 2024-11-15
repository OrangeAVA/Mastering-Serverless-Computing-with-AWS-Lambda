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

    const highPriorityDLQ = new Queue(this, 'AssignmentHighPriorityDLQ', {
      queueName: 'assignment-high-priority-dlq.fifo',
      fifo: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
    });
    
    const highPriorityQueue = new Queue(this, 'AssignmentHighPriorityQueue', {
      queueName: 'assignment-high-priority-queue.fifo',
      fifo: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      deduplicationScope: DeduplicationScope.QUEUE,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: highPriorityDLQ,
        maxReceiveCount: 3
      }
    });


    const lowPriorityDLQ = new Queue(this, 'AssignmentLowPriorityDLQ', {
      queueName: 'assignment-low-priority-dlq.fifo',
      fifo: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
    });
    

    const lowPriorityQueue = new Queue(this, 'AssignmentLowPriorityQueue', {
      queueName: 'assignment-low-priority-queue.fifo',
      fifo: true,
      visibilityTimeout: cdk.Duration.seconds(30),
      deduplicationScope: DeduplicationScope.QUEUE,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: lowPriorityDLQ,
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

    assignmentFunction.addEventSource(new SqsEventSource(lowPriorityQueue, {
      maxConcurrency: 2,
      enabled: true,
    }));

    assignmentFunction.addEventSource(new SqsEventSource(highPriorityQueue, {
      enabled: true,
    }));

    new StringParameter(this, 'AssignmentHighPriorityQueueArnParameter', {
      parameterName: '/assignment/highpriority/queue/arn',
      stringValue: highPriorityQueue.queueArn
    });

    new StringParameter(this, 'AssignmentLowPriorityQueueArnParameter', {
      parameterName: '/assignment/lowpriority/queue/arn',
      stringValue: lowPriorityQueue.queueArn
    });

    table.grantReadWriteData(functionRole);
    highPriorityDLQ.grantSendMessages(functionRole);
    highPriorityQueue.grantConsumeMessages(functionRole);
    lowPriorityDLQ.grantSendMessages(functionRole);
    lowPriorityQueue.grantConsumeMessages(functionRole);
  }
}
