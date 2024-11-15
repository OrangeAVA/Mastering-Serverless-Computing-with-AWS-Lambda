import { Construct } from 'constructs';
import { DefinitionBody, StateMachine, JsonPath, IStateMachine} from 'aws-cdk-lib/aws-stepfunctions';
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { BatchSubmitJob } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { EcsJobDefinition, IJobQueue } from 'aws-cdk-lib/aws-batch';

export interface StateMachineStackProps extends NestedStackProps {
  JobDefinition: EcsJobDefinition;
  JobQueue: IJobQueue;
}

class StateMachineStack extends NestedStack {
  readonly stateMachine: IStateMachine;
  constructor(scope: Construct, id: string, props: StateMachineStackProps) {
    super(scope, id, props);

    const stateDefinition =  new BatchSubmitJob(this, 'Submit Batch Job', {
      jobDefinitionArn: props.JobDefinition.jobDefinitionArn,
      jobName: JsonPath.stringAt('$.Id'),
      jobQueueArn: props.JobQueue.jobQueueArn,
    });

    const stateMachine = new StateMachine(this, 'ItemStateMachine', {
      stateMachineName: 'item-state-machine',
      definitionBody: DefinitionBody.fromChainable(stateDefinition)
    });

    this.stateMachine = stateMachine;
  }
}

export { StateMachineStack };