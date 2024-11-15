
import { Construct } from "constructs";
import { AwsIntegration, IntegrationOptions, IntegrationResponse } from "aws-cdk-lib/aws-apigateway";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";

export interface IStepFuncGatewayIntegrationProps {
  statemachine: IStateMachine;
  integrationRole: IRole;
}

export class StepFuncGatewayIntegration extends Construct {
  public readonly integration: AwsIntegration; 
  constructor(scope: Construct, id: string, props: IStepFuncGatewayIntegrationProps) {
        super(scope, id);

        props.statemachine.grantStartExecution(props.integrationRole);
        const response = {
            statusCode: "200",
            responseTemplates: {
              'application/json': `{
                "requestId": "$context.requestId"
              }`
            }
          } satisfies IntegrationResponse;

        const options = {
            credentialsRole: props.integrationRole,
            integrationResponses: [response ],
            requestTemplates: {
                "application/json": `{
                    "input": "{}", "stateMachineArn": "${props.statemachine.stateMachineArn}"
                }`,
            },
        } satisfies IntegrationOptions;

        this.integration = new AwsIntegration({
            service: "states",
            action: "StartExecution",
            integrationHttpMethod: "POST",
            options: options
        });
    }
}
