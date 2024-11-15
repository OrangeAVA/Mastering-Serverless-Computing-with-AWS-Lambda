
import { Construct } from "constructs";
import { AwsIntegration, IntegrationOptions } from "aws-cdk-lib/aws-apigateway";
import { IRole } from "aws-cdk-lib/aws-iam";
import { ITable } from "aws-cdk-lib/aws-dynamodb";

export interface IDynamoDbGatewayIntegrationProps {
  table: ITable;
  integrationRole: IRole;
}

export class DynamoDbGatewayIntegration extends Construct {
  public readonly integration: AwsIntegration; 
  constructor(scope: Construct, id: string, props: IDynamoDbGatewayIntegrationProps) {
    super(scope, id);

    props?.table.grantWriteData(props.integrationRole);

		const response = {
			statusCode: '200',
			responseTemplates: {
				'application/json': `{
					"requestId": "$context.requestId"
				}`,
			},
		}
		const options = {
			credentialsRole: props.integrationRole,
			integrationResponses: [ response ],
			requestTemplates: {
			'application/json': `{
				"Item": {
					"PK": {
					"S": "$context.requestId"
					},
					"SK": {
					"S": "$input.path('$.Id')"
					},
					"Name": {
						"S": "$input.path('$.Name')"
					}
				},
				"TableName": "${props?.table.tableName}"
				}`
			},
		} satisfies IntegrationOptions;

		this.integration = new AwsIntegration({
			action: 'PutItem',
			options: options,
			service: 'dynamodb',
		});
  }
}
