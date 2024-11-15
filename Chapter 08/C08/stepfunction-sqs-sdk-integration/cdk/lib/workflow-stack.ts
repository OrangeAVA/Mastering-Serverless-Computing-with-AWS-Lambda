import { Construct } from 'constructs';
import { DefinitionBody, StateMachine, JsonPath, IStateMachine, CustomState, TaskInput, Timeout} from 'aws-cdk-lib/aws-stepfunctions';
import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { IQueue } from 'aws-cdk-lib/aws-sqs';

export interface StateMachineStackProps extends NestedStackProps {
  Queue: IQueue;
}

class StateMachineStack extends NestedStack {
  readonly stateMachine: IStateMachine;
  constructor(scope: Construct, id: string, props: StateMachineStackProps) {
    super(scope, id, props);

    const stateDefinition = new CustomState(this, 'Send Message', {
      stateJson: {
        Resource: 'arn:aws:states:::aws-sdk:sqs:sendMessage.waitForTaskToken',
        Type: "Task",
        TimeoutSeconds: Timeout.duration(Duration.minutes(5)).seconds,
        HeartbeatSeconds: Timeout.duration(Duration.seconds(15)).seconds,
        Parameters: {
          "MessageBody.$": JsonPath.stringAt('$'),
          "MessageAttributes": {
            "taskToken": {
                "DataType": "String",
                "StringValue.$": JsonPath.taskToken,
            }
          },
          QueueUrl: props.Queue.queueUrl,
        }
      },
    });

    const stateMachine = new StateMachine(this, 'ItemStateMachine', {
      stateMachineName: 'item-state-machine',
      definitionBody: DefinitionBody.fromChainable(stateDefinition)
    });

    this.stateMachine = stateMachine;
  }
}

export { StateMachineStack };