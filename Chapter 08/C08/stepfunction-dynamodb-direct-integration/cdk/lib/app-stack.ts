import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { TableStack } from "./database/dynamodbTable";
import { StateMachineStack } from "./workflow-stack";

export interface AppProps extends StackProps {}

class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppProps) {
        super(scope, id, props);

        const tableStack = new TableStack(this, TableStack.name, { });
        new StateMachineStack(this, StateMachineStack.name, {
            Table: tableStack.Table
        });
    }
}

export { AppStack };