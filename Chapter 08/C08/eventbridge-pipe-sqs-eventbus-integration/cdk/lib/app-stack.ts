import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EventBus } from "aws-cdk-lib/aws-events";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { join, resolve } from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export interface AppProps extends StackProps {}
class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const queue = new Queue(this, Queue.name );
        const eventBus = new EventBus(this, EventBus.name, {});
      
        const lambdaRole = new Role(this, 'LambdaRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [{ managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' } ]   
        });

        const enrichmentFunction = new NodejsFunction(this, 'TriggerFunction', {
            entry: resolve(join(__dirname, '../../src/index.ts')),
            handler: 'handler',
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.minutes(5),
            role: lambdaRole,
            bundling: {
                externalModules: ['@aws-sdk'],
            },
        });

        const loggroup = new LogGroup(this, 'TriggerFunctionLogGroup', {
            logGroupName: `/aws/lambda/${enrichmentFunction.functionName}`,
            removalPolicy: RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_DAY
        });

        const piperole = new Role(this, 'PipeRole', { assumedBy: new ServicePrincipal('pipes.amazonaws.com') });
        new CfnPipe(this, 'Pipe', {
            source: queue.queueArn!,
            target: eventBus.eventBusArn,
            enrichment: enrichmentFunction.functionArn,
            logConfiguration: {
                level: 'TRACE',
                cloudwatchLogsLogDestination: {
                    logGroupArn: loggroup.logGroupArn,
                },
                includeExecutionData: ["ALL"],
            },
            targetParameters: {
                eventBridgeEventBusParameters: {
                    detailType: 'MessageReceived',
                    source: 'com.serverless.c08'
                },
                inputTemplate: `
                    {
                        "Id": <$.body.Id>,
                        "Name": <$.body.Name>
                    }          
                `,
            },
            roleArn: piperole.roleArn,
        })

        queue.grantConsumeMessages(piperole);
        eventBus.grantPutEventsTo(piperole);
        enrichmentFunction.grantInvoke(piperole);
    }
}

export { AppStack };