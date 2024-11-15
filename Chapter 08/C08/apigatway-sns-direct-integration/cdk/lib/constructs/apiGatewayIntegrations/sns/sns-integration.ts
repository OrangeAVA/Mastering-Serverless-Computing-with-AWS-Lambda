
import { Construct } from "constructs";
import { AwsIntegration, IntegrationOptions, IntegrationResponse, PassthroughBehavior } from "aws-cdk-lib/aws-apigateway";
import { IRole } from "aws-cdk-lib/aws-iam";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { x_www_form_urlencoded } from "../../../constants/httpContsnts";

export interface ISNSGatewayIntegrationProps {
  topic: ITopic;
  integrationRole: IRole;
}

export class SNSGatewayIntegration extends Construct {
  public readonly integration: AwsIntegration; 
  constructor(scope: Construct, id: string, props: ISNSGatewayIntegrationProps) {
    super(scope, id);

    props?.topic.grantPublish(props.integrationRole);

    const response = {
      statusCode: "200",
      responseTemplates: {
        'application/json': `{
          "requestId": "$context.requestId"
        }`
      }
    } satisfies IntegrationResponse;

    const integrationOptions = {
      credentialsRole: props.integrationRole,
      passthroughBehavior: PassthroughBehavior.NEVER,
      integrationResponses: [response],
      requestParameters: { 'integration.request.header.Content-Type': x_www_form_urlencoded },
      requestTemplates: { 'application/json': `TopicArn=$util.urlEncode(\'${props?.topic.topicArn}\')&&Message=$util.urlEncode($input.body)` },
    } satisfies IntegrationOptions;

    this.integration = new AwsIntegration({
    	service: 'sns',
      action: 'Publish',
    	integrationHttpMethod: 'POST',
    	options: integrationOptions
    });
  }
}
