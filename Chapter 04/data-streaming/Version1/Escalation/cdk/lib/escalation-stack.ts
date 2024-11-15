import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import { Architecture, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { KinesisEventSource, SqsDlq } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { DefinitionBody, JsonPath, StateMachine, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { DynamoAttributeValue, DynamoPutItem } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { resolve } from 'path';


export class EscalationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const functionRole = new Role(this, 'EscalationSchedulerFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const table = new Table(this, 'EscalationTable', {
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

    const deadLetterQueue = new Queue(this, 'EscalationAssignmentDLQ', {
      queueName: `${this.stackName}-escalation-assignment-dlq`,
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
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
      table: table,
    });
    const waitStep = new Wait(this, 'WaitForEscalationStep', { time: WaitTime.secondsPath('$.scheduledTime') });
    const workflowDefinition = ddbPutItemStep.next(waitStep);
    const escalationWorkflow = new StateMachine(this, 'EscalationWorkflow', {
      stateMachineName: `${this.stackName}-escalation-workflow`,
      definitionBody: DefinitionBody.fromChainable(workflowDefinition)
    });  

    escalationWorkflow.addToRolePolicy(new PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [table.tableArn]
    }));

    const assignmentDataStreamArn = StringParameter.valueForStringParameter(this, '/assignment/datastream/arn');     
    const assignmentDataStream = Stream.fromStreamArn(this, "AssignmentDataStreamArnParameter", assignmentDataStreamArn);

    const functionName = `${this.stackName}-escalation-scheduler-function`;
    const logGroup = new LogGroup(this, 'AssignmentFunctionLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    const escalationSchedulerFunction = new NodejsFunction(this, 'EscalationSchedulerFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/escalation/index.ts`),
      functionName: functionName,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      logGroup: logGroup,
      handler: 'handler',
      bundling: {
        minify: true,
        externalModules: [ '@aws-sdk/client-sfn' ]
      },
      environment: {
        STATE_MACHINE_ARN: escalationWorkflow.stateMachineArn,
      }
    });
    escalationSchedulerFunction.addEventSource(new KinesisEventSource(assignmentDataStream, {
      startingPosition: StartingPosition.LATEST,
      batchSize: 10,
      bisectBatchOnError: true,
      retryAttempts: 3,
      onFailure: new SqsDlq(deadLetterQueue)
    }));


    deadLetterQueue.grantSendMessages(functionRole);
    escalationWorkflow.grantStartExecution(functionRole);
    assignmentDataStream.grantRead(functionRole);
  }
}
