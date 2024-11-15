import { Construct } from 'constructs';
import { DefinitionBody, StateMachine, JsonPath, IStateMachine, Timeout, IntegrationPattern, TaskInput} from 'aws-cdk-lib/aws-stepfunctions';
import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SqsSendMessage } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { IQueue } from 'aws-cdk-lib/aws-sqs';

export interface StateMachineStackProps extends NestedStackProps {
  Queue: IQueue;
}

class StateMachineStack extends NestedStack {
  readonly stateMachine: IStateMachine;
  constructor(scope: Construct, id: string, props: StateMachineStackProps) {
    super(scope, id, props);

    const stateDefinition =  new SqsSendMessage(this, 'Send Message', {
      queue: props.Queue,
      integrationPattern: IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      taskTimeout: Timeout.duration(Duration.minutes(5)),
      heartbeatTimeout: Timeout.duration(Duration.seconds(15)),
      messageBody: TaskInput.fromObject({
        'data': JsonPath.stringAt('$'),
        'token': JsonPath.taskToken,
      }),
      resultPath: '$',

    });

    const stateMachine = new StateMachine(this, 'ItemStateMachine', {
      stateMachineName: 'item-state-machine',
      definitionBody: DefinitionBody.fromChainable(stateDefinition)
    });

    this.stateMachine = stateMachine;
  }
}

export { StateMachineStack };