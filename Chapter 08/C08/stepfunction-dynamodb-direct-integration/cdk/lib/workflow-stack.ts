import { Construct } from 'constructs';
import { CustomState, DefinitionBody, StateMachine, JsonPath, IStateMachine} from 'aws-cdk-lib/aws-stepfunctions';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { ITable } from 'aws-cdk-lib/aws-dynamodb';

export interface StateMachineStackProps extends NestedStackProps {
  Table: ITable;
}

class StateMachineStack extends NestedStack {
  readonly stateMachine: IStateMachine;
  constructor(scope: Construct, id: string, props: StateMachineStackProps) {
    super(scope, id, props);

    const defintion = new CustomState(this, 'Query Item', {
      stateJson: {
        Type: 'Task',
        Resource: "arn:aws:states:::aws-sdk:dynamodb:query",
        Parameters: {
          TableName: props.Table.tableName,
          Limit: 5,
          ScanIndexForward: true,
          KeyConditionExpression: `PK = :id`,
          ExpressionAttributeValues: {
            ":id": {
              "S.$": JsonPath.stringAt('$.Id')
            }
          }
        },
        ResultSelector: {
          'dataset.$': '$.Items'
        },
        ResultPath: '$'
      }
    });

    const stateMachine = new StateMachine(this, 'ItemStateMachine', {
      stateMachineName: 'item-state-machine',
      definitionBody: DefinitionBody.fromChainable(defintion)
    });

    stateMachine.addToRolePolicy(
      new PolicyStatement({
        actions: ["Dynamodb:query"],
        resources: [  props.Table.tableArn ],
      })
    );
    this.stateMachine = stateMachine;
  }
}

export { StateMachineStack };