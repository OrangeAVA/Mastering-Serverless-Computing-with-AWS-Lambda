import * as cdk from 'aws-cdk-lib';
import { EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { EventField } from 'aws-cdk-lib/aws-events';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnPipe } from 'aws-cdk-lib/aws-pipes';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { resolve } from 'path';

export class TicketingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new RestApi(this, 'TicketingApi', {
      restApiName: `ticketing-api`,
      endpointTypes: [EndpointType.REGIONAL],
      cloudWatchRole: true,
      deployOptions: {
        stageName: 'live'
      },
    });
    
    const functionRole = new Role(this, 'AddTicketFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const table = new Table(this, 'TicketTable', {
      tableName: 'ticket-table',
      partitionKey: {
        name: 'ticketId',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: StreamViewType.NEW_IMAGE,
    });

    const functionName = `add-ticket-function`;
    const logGroup = new LogGroup(this, 'AddTicketFunctionLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const addTicketFunction = new NodejsFunction(this, 'AddTicketFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/add-ticket/index.ts`),
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

    const lambdaProxyIntegration = new LambdaIntegration(addTicketFunction);
    const apiResource = api.root.addResource('ticket');
    apiResource.addMethod(
        'POST', 
        lambdaProxyIntegration);

    const pipeRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('pipes.amazonaws.com'),
    });

    const assignmentHighPriorityQueueArn = StringParameter.valueForStringParameter(this, '/assignment/highpriority/queue/arn');     
    const assignmentHighPriorityQueue = Queue.fromQueueArn(this, "AssignmentHighPriorityQueueArnArnParameter", assignmentHighPriorityQueueArn);
    new CfnPipe(this, 'HighPriorityPipe', {
      roleArn: pipeRole.roleArn,
      source: table.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
        },
        filterCriteria: {
          filters: [{
              pattern: `{ 
                "dynamodb": {
                  "NewImage": { 
                    "category": { 
                      "S": [ "HighPriority" ] 
                    } 
                  } 
                } 
              }`}]
        }
      },
      target: assignmentHighPriorityQueue.queueArn,
      targetParameters: {
        sqsQueueParameters: {
          messageGroupId: 'ticketing',
          messageDeduplicationId: EventField.fromPath('$.dynamodb.NewImage.ticketId.S'),
        },
        inputTemplate: `
          {
            "ticketId": <$.dynamodb.NewImage.ticketId.S>, 
            "category": <$.dynamodb.NewImage.category.S>, 
            "message": <$.dynamodb.NewImage.message.S>,
            "creationDate": <$.dynamodb.NewImage.createdAt.S>
          }`
      }
    });

    const assignmentLowPriorityQueueArn = StringParameter.valueForStringParameter(this, '/assignment/lowpriority/queue/arn');     
    const assignmentLowPriorityQueue = Queue.fromQueueArn(this, "AssignmentLowPriorityQueueArnArnParameter", assignmentLowPriorityQueueArn);
    new CfnPipe(this, 'LowPriorityPipe', {
      roleArn: pipeRole.roleArn,
      source: table.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
        },
        filterCriteria: {
          filters: [{
              pattern: `{ 
                "dynamodb": {
                  "NewImage": { 
                    "category": { 
                      "S": [ "LowPriority" ] 
                    } 
                  } 
                } 
              }`}]
        }
      },
      target: assignmentLowPriorityQueue.queueArn,
      targetParameters: {
        sqsQueueParameters: {
          messageGroupId: 'ticketing',
          messageDeduplicationId: EventField.fromPath('$.dynamodb.NewImage.ticketId.S'),
        },
        inputTemplate: `
          {
            "ticketId": <$.dynamodb.NewImage.ticketId.S>, 
            "category": <$.dynamodb.NewImage.category.S>, 
            "message": <$.dynamodb.NewImage.message.S>,
            "creationDate": <$.dynamodb.NewImage.createdAt.S>
          }`
      }
    });

    table.grantReadWriteData(functionRole);
    table.grantStreamRead(pipeRole);
    assignmentHighPriorityQueue.grantSendMessages(pipeRole);
    assignmentLowPriorityQueue.grantSendMessages(pipeRole);
  }
}
