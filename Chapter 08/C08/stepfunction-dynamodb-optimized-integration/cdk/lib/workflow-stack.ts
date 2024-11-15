import { Construct } from 'constructs';
import { DefinitionBody, StateMachine, JsonPath, IStateMachine} from 'aws-cdk-lib/aws-stepfunctions';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { DynamoAttributeValue, DynamoGetItem } from 'aws-cdk-lib/aws-stepfunctions-tasks';

export interface StateMachineStackProps extends NestedStackProps {
  Table: ITable;
}

class StateMachineStack extends NestedStack {
  readonly stateMachine: IStateMachine;
  constructor(scope: Construct, id: string, props: StateMachineStackProps) {
    super(scope, id, props);

    const stateDefinition =  new DynamoGetItem(this, 'Get Item', {
      table: props.Table,
      key: { 'PK': DynamoAttributeValue.fromString(JsonPath.stringAt('$.Id')) },
    });

    const stateMachine = new StateMachine(this, 'ItemStateMachine', {
      stateMachineName: 'item-state-machine',
      definitionBody: DefinitionBody.fromChainable(stateDefinition)
    });

    stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ["Dynamodb:getItem"],
        resources: [  props.Table.tableArn ],
      })
    );
    this.stateMachine = stateMachine;
  }
}

export { StateMachineStack };