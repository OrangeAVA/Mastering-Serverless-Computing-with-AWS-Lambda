import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { resolve } from 'path';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { EventBus, Rule  } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';

export class EventBridgeIntegrationStack extends Stack {
  private static readonly handlersPath = 'src/handlers';

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const role = new Role(this, 'listener-function-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const eventBus =  new EventBus(this, 'event-bus', { eventBusName: 'event-bus' })

    const listenerdeadletterqueue = new Queue(this, 'listener-dead-letter-queue', { queueName: 'listener-dead-letter-queue' });
    listenerdeadletterqueue.grantSendMessages(role);

    const listenerFunction = new NodejsFunction(this, 'listener-function', {
      role,
      entry: resolve(`${EventBridgeIntegrationStack.handlersPath}/listener/index.ts`),
      functionName: `listener-function`,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      handler: 'handler',
      bundling: {
        sourceMap: false 
      },
      deadLetterQueue: listenerdeadletterqueue,
      retryAttempts: 2,
      maxEventAge: Duration.hours(1)
    });

    const targetDeadletterqueue = new Queue(this, 'target-dead-letter-queue', { queueName: 'target-dead-letter-queue' });

    new Rule(this, 'event-bus-lambda-integration', {
      ruleName: 'event-bus-lambda-integration',
      eventPattern: {
        source: ['com.company.myservice']
      },
      eventBus,
    }).addTarget(new LambdaFunction(listenerFunction, {
      deadLetterQueue: targetDeadletterqueue,
      maxEventAge: Duration.hours(1),
      retryAttempts: 3
    }));

  }
}