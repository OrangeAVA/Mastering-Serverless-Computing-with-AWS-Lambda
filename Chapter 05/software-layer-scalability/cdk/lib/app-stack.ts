import * as cdk from 'aws-cdk-lib';
import { EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, BillingMode, StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnPipe } from 'aws-cdk-lib/aws-pipes';
import { Construct } from 'constructs';
import { resolve } from 'path';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new RestApi(this, 'Api', {
      restApiName: `software-component-layer-api`,
      endpointTypes: [EndpointType.REGIONAL],
      cloudWatchRole: true,
      deployOptions: {
        stageName: 'live'
      },
    });
    
    const functionRole = new Role(this, 'AddRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const table = new Table(this, 'ItemTable', {
      tableName: 'item-table',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: StreamViewType.NEW_IMAGE,
    });

    const functionName = `add-item-function`;
    const addItemLogGroup = new LogGroup(this, 'AddItemFunctionLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const addItemFunction = new NodejsFunction(this, 'AddItemFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/add/index.ts`),
      functionName: functionName,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      logGroup: addItemLogGroup,
      handler: 'handler',
      bundling: {
        platform: 'node',
        format: OutputFormat.ESM,
        minify: true,
        sourceMap: true,
        sourcesContent: false,
        mainFields: ['module', 'main'],
        metafile: true, // this is used for bundle analysis and is not needed for production
        externalModules: [ '@aws-sdk/client-dynamodb' ]
      },
      environment: {
        TABLE_NAME: table.tableName,
      }
    });

    const lambdaProxyIntegration = new LambdaIntegration(addItemFunction);
    const apiResource = api.root.addResource('item');
    apiResource.addMethod(
        'POST', 
        lambdaProxyIntegration);

    const pipeRole = new Role(this, 'role', {
      assumedBy: new ServicePrincipal('pipes.amazonaws.com'),
    });

    const eventBus = new EventBus(this, 'event-bus');

    new CfnPipe(this, 'pipe', {
      roleArn: pipeRole.roleArn,
      source: table.tableStreamArn!,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
          
        },
      },
      target: eventBus.eventBusArn,
      targetParameters: {
        inputTemplate: `
          {
            "id": <$.dynamodb.NewImage.id.S>, 
            "name": <$.dynamodb.NewImage.name.S>, 
            "creationDate": <$.dynamodb.NewImage.createdAt.S>
          }`
      }
    });

    table.grantReadWriteData(functionRole);
    eventBus.grantPutEventsTo(pipeRole);
    table.grantStreamRead(pipeRole);
  }
}
