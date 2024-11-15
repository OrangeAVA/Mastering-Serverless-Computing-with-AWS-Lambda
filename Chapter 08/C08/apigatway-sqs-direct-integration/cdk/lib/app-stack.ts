import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EventBus } from "aws-cdk-lib/aws-events";
import { ApiStack } from "./api-stack";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import { Queue } from "aws-cdk-lib/aws-sqs";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const queue = new Queue(this, Queue.name );
        const eventBus = new EventBus(this, EventBus.name, {});
      
        const api = new ApiStack( this, ApiStack.name, {
            queue: queue,
        });

        const piperole = new Role(this, 'PipeRole', { assumedBy: new ServicePrincipal('pipes.amazonaws.com') });
        new CfnPipe(this, 'Pipe', {
            source: queue.queueArn!,
            target: eventBus.eventBusArn,
            targetParameters: {
                eventBridgeEventBusParameters: {
                    detailType: 'NewStreamRecord',
                    source: 'com.serverless.c08'
                },
                inputTemplate: `
                    {
                        "correlationId": <$.eventID>
                        "Id": <$.Id>,
                        "Name": <$.Name>
                    }          
                `,
            },
            roleArn: piperole.roleArn,
        })

        queue.grantConsumeMessages(piperole);
        eventBus.grantPutEventsTo(piperole);

        new CfnOutput(this, "ApiEndpoint", { 
            value: api.Api.url,
            exportName: `${id}-ApiEndpoint`
        });
    }
}

export { AppStack };