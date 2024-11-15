import { Construct } from "constructs";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { EndpointType, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { SNSGatewayIntegration } from "./constructs/apiGatewayIntegrations/sns/sns-integration";
import { ITopic } from "aws-cdk-lib/aws-sns";

interface ApiStackProps extends NestedStackProps { 
    topic: ITopic,
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

        const integration = new SNSGatewayIntegration(
            this,
            SNSGatewayIntegration.name,
            {
                topic: props.topic,
                integrationRole: integrationRole,
            }
        );

        const apiResource = this.Api.root.addResource('sns');
        apiResource.addMethod(
            'POST', 
            integration.integration,
            this.methodResponse
        );
    }
}

export { ApiStack };