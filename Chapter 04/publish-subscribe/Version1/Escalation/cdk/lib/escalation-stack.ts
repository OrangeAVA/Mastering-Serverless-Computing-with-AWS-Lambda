import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { DefinitionBody, JsonPath, StateMachine, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { DynamoAttributeValue, DynamoPutItem } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { resolve } from 'path';


export class EscalationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const escalationSchedulerFunctionRole = new Role(this, 'EscalationSchedulerFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const escalationTable = new Table(this, 'EscalationTable', {
      tableName: `${this.stackName}-escalation-table`,
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

    const escalationAssignmentDLQ = new Queue(this, 'EscalationAssignmentDLQ', {
      queueName: `${this.stackName}-escalation-assignment-dlq`,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
    });

    const escalationAssignmentQueue = new Queue(this, 'EscalationAssignmentQueue', {
      queueName: `${this.stackName}-escalation-assignment-queue`,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: escalationAssignmentDLQ,
        maxReceiveCount: 3
      }
    });
    
    const ddbPutItemStep = new DynamoPutItem(this, 'DynamoDbPutEscalationResultItemStep', {
      item: {
        PK: DynamoAttributeValue.fromString(JsonPath.stringAt('$.ticketId')),
        SK: DynamoAttributeValue.fromString(JsonPath.stringAt('$.assignedAt')),
        category: DynamoAttributeValue.fromString(JsonPath.stringAt('$.category')),
        staffId: DynamoAttributeValue.fromString(JsonPath.stringAt('$.staffId'))
      },
      resultSelector: {
        'dynamodbRequestId': JsonPath.stringAt('$.SdkResponseMetadata.RequestId')
      },
      resultPath: '$.dynamodb',
      table: escalationTable,
    });
    const waitStep = new Wait(this, 'WaitForEscalationStep', { time: WaitTime.secondsPath('$.scheduledTime') });
    const workflowDefinition = ddbPutItemStep.next(waitStep);
    const escalationWorkflow = new StateMachine(this, 'EscalationWorkflow', {
      stateMachineName: `${this.stackName}-escalation-workflow`,
      definitionBody: DefinitionBody.fromChainable(workflowDefinition)
    });  

    escalationWorkflow.addToRolePolicy(new PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [escalationTable.tableArn]
    }));

    const escalationSchedulerFunctionName = `${this.stackName}-escalation-scheduler-function`;
    const escalationSchedulerFunctionLogGroup = new LogGroup(this, 'AssignmentFunctionLogGroup', {
      logGroupName: `/aws/lambda/${escalationSchedulerFunctionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const escalationSchedulerFunction = new NodejsFunction(this, 'EscalationSchedulerFunction', {
      role: escalationSchedulerFunctionRole,
      entry: resolve(`src/handlers/escalation/index.ts`),
      functionName: escalationSchedulerFunctionName,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      logGroup: escalationSchedulerFunctionLogGroup,
      handler: 'handler',
      bundling: {
        minify: true,
        externalModules: [ '@aws-sdk/client-sfn' ]
      },
      environment: {
        STATE_MACHINE_ARN: escalationWorkflow.stateMachineArn,
      }
    });

    escalationSchedulerFunction.addEventSource(new SqsEventSource(escalationAssignmentQueue, {
      enabled: true,
    }));

    const assignmentTopicArn = StringParameter.valueForStringParameter(this, '/assignment/broker/topic/arn');     
    const assignmentTopic = Topic.fromTopicArn(this, "assignmentTopicArnParameter", assignmentTopicArn);
    const assignmentSubscriptionDLQ = new Queue(this, 'AssignmentSubscriptionDLQ', {
      queueName: `${this.stackName}-escalation-assignment-subscription-dlq`,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
    });

    assignmentTopic.addSubscription(
      new SqsSubscription(escalationAssignmentQueue, {
        deadLetterQueue: assignmentSubscriptionDLQ,
        rawMessageDelivery: true
      })
    );

    assignmentTopic.addToResourcePolicy(new PolicyStatement({
      actions: ['sns:Subscribe'],
      resources: [assignmentTopic.topicArn],
      principals: [new ServicePrincipal('sqs.amazonaws.com')],
      conditions: {
        ArnEquals: {
          'aws:SourceArn': escalationAssignmentQueue.queueArn
        }
      }
    }));

    escalationAssignmentDLQ.grantSendMessages(escalationSchedulerFunctionRole);
    escalationAssignmentQueue.grantConsumeMessages(escalationSchedulerFunctionRole);
    escalationWorkflow.grantStartExecution(escalationSchedulerFunctionRole);
  }
}
