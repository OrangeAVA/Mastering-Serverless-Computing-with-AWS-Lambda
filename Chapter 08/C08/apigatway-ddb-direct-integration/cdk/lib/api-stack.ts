import { Construct } from "constructs";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { EndpointType, RestApi } from "aws-cdk-lib/aws-apigateway";
import { ITable } from "aws-cdk-lib/aws-dynamodb";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { DynamoDbGatewayIntegration } from "./constructs/apiGatewayIntegrations/dynamodb/ddb-integration";

interface ApiStackProps extends NestedStackProps { 
    dynamodbTable: ITable,
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

        const ddbIntegration = new DynamoDbGatewayIntegration(
            this,
            DynamoDbGatewayIntegration.name,
            {
                table: props.dynamodbTable,
                integrationRole: integrationRole,
            }
        );

        const ddbApiResource = this.Api.root.addResource('ddb');
        ddbApiResource.addMethod(
            'POST', 
            ddbIntegration.integration,
            this.methodResponse
        );
    }
}

export { ApiStack };