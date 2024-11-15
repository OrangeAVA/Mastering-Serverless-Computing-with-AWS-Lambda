import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "./api-stack";
import { Topic } from "aws-cdk-lib/aws-sns";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const topic = new Topic(this, Topic.name );
      
        const api = new ApiStack( this, ApiStack.name, {
            topic: topic,
        });


        new CfnOutput(this, "ApiEndpoint", { 
            value: api.Api.url,
            exportName: `${id}-ApiEndpoint`
        });
    }
}

export { AppStack };