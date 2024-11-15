import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus, Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { DefinitionBody, JsonPath, StateMachine, TaskInput, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { DynamoAttributeValue, DynamoPutItem, EventBridgePutEvents } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { resolve } from 'path';


export class EscalationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const eventBusArn = StringParameter.valueForStringParameter(this, '/ticketing/broker/eventbus/arn');
    const eventBus = EventBus.fromEventBusArn(this, 'TicketingEventBus', eventBusArn);
    
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
    const pushEvent = new EventBridgePutEvents(this, 'PushEscalationEventStep', {
      entries: [
        {
          source: 'escalation',
          detailType: 'v1.ticket.escalated',
          detail: TaskInput.fromObject({
            ticketId: JsonPath.stringAt('$.ticketId'),
            staffId: JsonPath.stringAt('$.staffId'),
            category: JsonPath.stringAt('$.category'),
            assignedAt: JsonPath.stringAt('$.assignedAt')
          }),
          eventBus: eventBus
        }
      ],

    });
    const workflowDefinition = ddbPutItemStep.next(waitStep).next(pushEvent);
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

    const assignmentSubscriptionDLQ = new Queue(this, 'AssignmentSubscriptionDLQ', {
      queueName: `${this.stackName}-escalation-assignment-subscription-dlq`,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
    });

    new Rule(this, 'AssignementRule', {
      eventBus: eventBus,
      eventPattern: {
        source: ['assignment'],
        detailType: ['v1.ticket.assigned']
      },
      targets: [
        new SqsQueue(escalationAssignmentQueue, {
          deadLetterQueue: assignmentSubscriptionDLQ,
          retryAttempts: 3,
          message: RuleTargetInput.fromEventPath('$.detail')
        })
      ]
    });

    escalationAssignmentDLQ.grantSendMessages(escalationSchedulerFunctionRole);
    escalationAssignmentQueue.grantConsumeMessages(escalationSchedulerFunctionRole);
    escalationWorkflow.grantStartExecution(escalationSchedulerFunctionRole);
  }
}
