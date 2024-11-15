import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { resolve } from 'path';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';

export class AgwIntegrationStack extends Stack {
  private static readonly handlersPath = 'src/handlers';

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const role = new Role(this, 'listener-function-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const agw = new RestApi( this, RestApi.name, {
      restApiName: `apigateway-rest-api`,
      endpointTypes: [EndpointType.REGIONAL],
      cloudWatchRole: true,
      deployOptions: {
        stageName: 'live'
      }
    });

    const proxiedFunction = new NodejsFunction(this, 'listener-function', {
      role,
      entry: resolve(`${AgwIntegrationStack.handlersPath}/index.ts`),
      functionName: `listener-function`,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      handler: 'handler',
      bundling: {
        sourceMap: false 
      }
    });

    const lambdaProxyIntegration = new LambdaIntegration(proxiedFunction, {
      timeout: Duration.seconds(10)
    });
    const lambdaApiResource = agw.root.addResource('lambda');
    lambdaApiResource.addMethod(
        'POST', 
        lambdaProxyIntegration);
  }
}