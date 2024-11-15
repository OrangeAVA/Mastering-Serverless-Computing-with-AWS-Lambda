import * as cdk from 'aws-cdk-lib';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnPipe } from 'aws-cdk-lib/aws-pipes';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { resolve } from 'path';


export class EscalationListenerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const functionRole = new Role(this, 'EscalationFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const escalationListenerDLQ = new Queue(this, 'EscalationListenerDLQ', {
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14)
    });
    
    const escalationListenerQueue = new Queue(this, 'EscalationListenerQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(1),
      deadLetterQueue: {
        queue: escalationListenerDLQ,
        maxReceiveCount: 3
      }
    });

    const assignementTableName = StringParameter.valueForStringParameter(this, '/assignment/database/table/name');     
    const table = Table.fromTableName(this, 'AssignmentTable', assignementTableName);

    const functionName = `${this.stackName}-listener-function`;
    const logGroup = new LogGroup(this, 'EscalationFunctionLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const escalationFunction = new NodejsFunction(this, 'EscalationFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/escalation-listener/index.ts`),
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
    
    escalationFunction.addEventSource(new SqsEventSource(escalationListenerQueue, {
      enabled: true,
    }));

    const escalationTopicArn = StringParameter.valueForStringParameter(this, '/escalation/broker/topic/arn');     
    const escalationTopic = Topic?.fromTopicArn(this, 'EscalationTopic', escalationTopicArn);
    escalationTopic.addSubscription(new SqsSubscription(escalationListenerQueue));
    escalationTopic.addToResourcePolicy(new PolicyStatement({
      actions: ['sns:Subscribe'],
      resources: [escalationTopic.topicArn],
      principals: [new ServicePrincipal('sqs.amazonaws.com')],
      conditions: {
        ArnEquals: {
          'aws:SourceArn': escalationListenerQueue.queueArn
        }
      }
    }));


    table.grantReadWriteData(functionRole);
    escalationListenerDLQ.grantSendMessages(functionRole);
    escalationListenerQueue.grantConsumeMessages(functionRole);
  }
}
