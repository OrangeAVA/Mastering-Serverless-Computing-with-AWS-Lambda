import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StateMachineStack } from "./workflow-stack";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { join, resolve } from "path";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const queue = new Queue(this, 'Queue', {
            visibilityTimeout: Duration.minutes(10)
        });
        
        const sfn = new StateMachineStack(this, StateMachineStack.name, {
            Queue: queue
        });

        const triggerFunction = new NodejsFunction(this, 'TriggerFunction', {
            entry: resolve(join(__dirname, '../../src/index.ts')),
            handler: 'handler',
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.minutes(5),
            bundling: {
                externalModules: ['@aws-sdk'],
            },
        });

        new LogGroup(this, 'TriggerFunctionLogGroup', {
            logGroupName: `/aws/lambda/${triggerFunction.functionName}`,
            removalPolicy: RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_DAY
        });

        triggerFunction.addEventSource(new SqsEventSource(queue));
        queue.grantConsumeMessages(triggerFunction);
        sfn.stateMachine.grantTaskResponse(triggerFunction);
    }
}

export { AppStack };