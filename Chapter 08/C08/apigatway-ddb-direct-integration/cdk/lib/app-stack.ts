import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { EventBus } from "aws-cdk-lib/aws-events";
import { ApiStack } from "./api-stack";
import { TableStack } from "./database/dynamodbTable";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const table = new TableStack(this, TableStack.name, {  });
        const eventBus = new EventBus(this, EventBus.name, {});
      
        const api = new ApiStack( this, ApiStack.name, {
            dynamodbTable: table.Table,
        });

        const piperole = new Role(this, 'PipeRole', { assumedBy: new ServicePrincipal('pipes.amazonaws.com') });
        new CfnPipe(this, 'Pipe', {
            source: table.Table.tableStreamArn!,
            sourceParameters: {
                dynamoDbStreamParameters: {
                    startingPosition: 'LATEST'
                }
            },
            target: eventBus.eventBusArn,
            targetParameters: {
                eventBridgeEventBusParameters: {
                    detailType: 'NewStreamRecord',
                    source: 'com.serverless.c08'
                },
                inputTemplate: `
                    {
                        "correlationId": <$.eventID>
                        "PK": <$.dynamodb.Keys.PK.S>,
                        "SK": <$.dynamodb.Keys.SK.S>,
                        "Name": <$.dynamodb.NewImage.Name.S>
                    }          
                `,
            },
            roleArn: piperole.roleArn,
        })

        table.Table.grantStreamRead(piperole);
        eventBus.grantPutEventsTo(piperole);

        new CfnOutput(this, "ApiEndpoint", { 
            value: api.Api.url,
            exportName: `${id}-ApiEndpoint`
        });
    }
}

export { AppStack };