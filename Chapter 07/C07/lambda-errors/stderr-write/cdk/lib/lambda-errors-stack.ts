import * as cdk from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { resolve } from 'path';

export class LambdaErrorsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const functionRole = new Role(this, 'LambdaErrorsFunctionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const functionName = `lambda-errors-function`;
    const logGroup = new LogGroup(this, 'LambdaErrorsFunctionLogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    new NodejsFunction(this, 'LambdaErrorsFunction', {
      role: functionRole,
      entry: resolve(`src/handlers/lambda-errors/index.ts`),
      functionName: functionName,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      awsSdkConnectionReuse: false,
      logGroup: logGroup,
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE,
        sourcesContent: false,
        externalModules: [ '@aws-sdk/client-dynamodb' ]
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      }
    });

  }
}
