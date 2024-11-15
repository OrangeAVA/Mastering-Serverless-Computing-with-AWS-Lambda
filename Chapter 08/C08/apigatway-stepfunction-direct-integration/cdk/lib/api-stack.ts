import { Construct } from "constructs";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { EndpointType, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { StepFuncGatewayIntegration } from "./constructs/apiGatewayIntegrations/sfn/sfn-integration";
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";

interface ApiStackProps extends NestedStackProps { 
    stateMachine: IStateMachine,
}

class ApiStack extends NestedStack {
    public readonly Api: RestApi;

    private readonly methodResponse = { methodResponses: [{ statusCode: "200" }] };

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        const integrationRole = new Role(this, 'integration-role', { assumedBy: new ServicePrincipal('apigateway.amazonaws.com') });

        this.Api = new RestApi(
            this,
            RestApi.name, 
            {
                endpointTypes: [EndpointType.REGIONAL],
                cloudWatchRole: true,
                deployOptions: {
                    stageName: 'live'
                },
            });

        const integration = new StepFuncGatewayIntegration(
            this,
            StepFuncGatewayIntegration.name,
            {
                statemachine: props.stateMachine,
                integrationRole: integrationRole,
            }
        );

        const apiResource = this.Api.root.addResource('sfn');
        apiResource.addMethod(
            'POST', 
            integration.integration,
            this.methodResponse
        );
    }
}

export { ApiStack };