import * as cdk from 'aws-cdk-lib';
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { CfnDiscoverer, CfnRegistry } from 'aws-cdk-lib/aws-eventschemas';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { resolve } from 'path';

export class EventBusStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const eventBus = new EventBus(this, 'TicketingEventBus');
    new CfnDiscoverer(this, 'TicketingSchemaDiscoverer', {
        sourceArn: eventBus.eventBusArn,
        description: 'Ticketing Schema Registry'
    });

    const defaultBus = EventBus.fromEventBusName(this, 'DefaultEventBus', 'default');
    const schemaHandlerFunctionRole = new Role(this, 'SchemaHandlerFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    const schemaHandlerFunctionName = `${this.stackName}-schema-handler-function`;
    const schemaHandlerFunctionLogGroup = new LogGroup(this, 'SchemaHandlerFunctionLogGroup', {
      logGroupName: `/aws/lambda/${schemaHandlerFunctionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    const schemaHandlerFunction = new NodejsFunction(this, 'SchemaHandlerFunction', {
      role: schemaHandlerFunctionRole,
      entry: resolve(`src/handlers/schema-handler/index.ts`),
      functionName: schemaHandlerFunctionName,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      logGroup: schemaHandlerFunctionLogGroup,
      handler: 'handler',
      bundling: {
        minify: true,
      },
    });

    schemaHandlerFunction.addPermission('SchemaHandlerFunctionInvokePermission', {
      principal: new ServicePrincipal('events.amazonaws.com'),
      sourceArn: defaultBus.eventBusArn
    });
    
    new Rule(this, 'TicketingSchemaRule', {
      eventBus: defaultBus,
      eventPattern: {
        source: ["aws.schemas"],
        detailType: [
          "Schema Created",
          "Schema Version Created"
        ]
      },
      targets: [
        new LambdaFunction(schemaHandlerFunction)
      ]
    });

    new StringParameter(this, 'TicketingBrokerArnParameter', {
      parameterName: '/ticketing/broker/eventbus/arn',
      stringValue: eventBus.eventBusArn
    });
  }
}
