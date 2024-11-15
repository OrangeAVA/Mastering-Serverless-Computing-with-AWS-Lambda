import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { ApiStack } from "./api-stack";
import { Pass, StateMachine, StateMachineType } from "aws-cdk-lib/aws-stepfunctions";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const stateMachine = new StateMachine(this, StateMachine.name , {
            definition: new Pass(this, 'PassState', { result: {value:"OK"} }),
            stateMachineType: StateMachineType.STANDARD
        });      

        const api = new ApiStack( this, ApiStack.name, {
            stateMachine,
        });

        new CfnOutput(this, "ApiEndpoint", { 
            value: api.Api.url,
            exportName: `${id}-ApiEndpoint`
        });
    }
}

export { AppStack };