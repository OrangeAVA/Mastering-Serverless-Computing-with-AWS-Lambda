import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { resolve } from 'path';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

export class SnsIntegrationStack extends Stack {
  private static readonly handlersPath = 'src/handlers';

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const role = new Role(this, 'listener-function-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    const listenerdeadletterqueue = new Queue(this, 'listener-dead-letter-queue', { queueName: 'listener-dead-letter-queue' });
    listenerdeadletterqueue.grantSendMessages(role);

    const listenerFunction = new NodejsFunction(this, 'listener-function', {
      role,
      entry: resolve(`${SnsIntegrationStack.handlersPath}/listener/index.ts`),
      functionName: `listener-function`,
      architecture: Architecture.ARM_64,
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      handler: 'handler',
      bundling: {
        sourceMap: false 
      },
      deadLetterQueue: listenerdeadletterqueue
    });

    const snsTopic = new Topic(this, 'topic', { topicName: 'topic' });

    const subscriptionDeadLetterQueue = new Queue(this, 'subscription-dead-letter-queue', { queueName: 'subscription-dead-letter-queue' });

    subscriptionDeadLetterQueue.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [ 'SQS:SendMessage'],
      principals: [ new ServicePrincipal('sns.amazonaws.com')],
      conditions: {
        'ArnEquals': {
          'aws:SourceArn': snsTopic.topicArn
        }
      }
    }))

    snsTopic.addSubscription(new LambdaSubscription(listenerFunction, {
      deadLetterQueue: subscriptionDeadLetterQueue
    }))
  }
}