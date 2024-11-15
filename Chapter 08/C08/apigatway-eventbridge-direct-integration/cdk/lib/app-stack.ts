import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "./api-stack";
import { EventBus } from "aws-cdk-lib/aws-events";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const eventBus = new EventBus(this, EventBus.name );
      
        const api = new ApiStack( this, ApiStack.name, {
            eventBus,
        });

        new CfnOutput(this, "ApiEndpoint", { 
            value: api.Api.url,
            exportName: `${id}-ApiEndpoint`
        });
    }
}

export { AppStack };