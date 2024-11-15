import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { resolve } from 'path';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';

export class SqsIntegrationStack extends Stack {
  private static readonly handlersPath = 'src/handlers';

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const role = new Role(this, 'enrich-function-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      inlinePolicies: {
        'sqs-changevisibility-timeout': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'sqs:ChangeMessageVisibility'
              ],
              resources: [
                '*'
              ]
            })
          ]
        })
      }
    });

    const table = new Table(this, 'articles-table', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: 'id', type: AttributeType.STRING },
      tableName: 'articles-table',
      removalPolicy: RemovalPolicy.DESTROY
    });

    table.grantWriteData(role);

    const articlesQueue = new Queue(this, 'articles-queue', {
      queueName: 'articles-queue',
      visibilityTimeout: Duration.seconds(900),
    });

    articlesQueue.grantConsumeMessages(role);
    
    const enrichFunction = new NodejsFunction(this, 'enrich-function', {
      role,
      entry: resolve(`${SqsIntegrationStack.handlersPath}/enrich/index.ts`),
      functionName: `enrich-function`,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(300),
      handler: 'handler',
      bundling:{ 
        externalModules:[ 
          "aws-sdk/client-dynamodb",
          "@aws-sdk/util-dynamodb"
        ]
      },
      environment: {
        'TABLE_NAME': table.tableName,
        'QUEUE_URL': articlesQueue.queueUrl
      }
    });

    enrichFunction.addEventSource(new SqsEventSource(articlesQueue));
  }
}