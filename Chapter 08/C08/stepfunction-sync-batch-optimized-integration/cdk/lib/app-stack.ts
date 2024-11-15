import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StateMachineStack } from "./workflow-stack";
import { FargateBatchJobStack } from "./batch/job";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const fragateStack =  new FargateBatchJobStack(this, FargateBatchJobStack.name, { });
        new StateMachineStack(this, StateMachineStack.name, {
            JobDefinition: fragateStack.JobDefinition,
            JobQueue: fragateStack.JobQueue
        });
    }
}

export { AppStack };