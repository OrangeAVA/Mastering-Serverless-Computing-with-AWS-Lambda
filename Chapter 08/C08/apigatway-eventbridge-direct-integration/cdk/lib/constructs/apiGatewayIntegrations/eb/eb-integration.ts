
import { Construct } from "constructs";
import { AwsIntegration, IntegrationOptions, IntegrationResponse, PassthroughBehavior, StepFunctionsIntegration } from "aws-cdk-lib/aws-apigateway";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IEventBus } from "aws-cdk-lib/aws-events";

export interface IEventBridgeGatewayIntegrationProps {
  eventBus: IEventBus;
  integrationRole: IRole;
}

export class EventBridgeGatewayIntegration extends Construct {
  public readonly integration: AwsIntegration; 
  constructor(scope: Construct, id: string, props: IEventBridgeGatewayIntegrationProps) {
        super(scope, id);

        props.eventBus.grantPutEventsTo(props.integrationRole);
        const response = {
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({
              id: "$input.path('$.Entries[0].EventId')",
            }),
          },
        } satisfies IntegrationResponse;

        const options = {
          credentialsRole: props.integrationRole,
          passthroughBehavior: PassthroughBehavior.NEVER,
          integrationResponses: [response],
          requestTemplates: {
            'application/json': `
              #set($context.requestOverride.header.X-Amz-Target ="AWSEvents.PutEvents")
              #set($context.requestOverride.header.Content-Type ="application/x-amz-json-1.1")
              ${JSON.stringify({
                Entries: [
                  {
                    DetailType: 'putEvent',
                    Detail: "$util.escapeJavaScript($input.json('$'))",
                    Source: 'async-eventbridge-api',
                    EventBusName: props.eventBus.eventBusArn,
                  },
                ],
              })}
            `,
          },
        } satisfies IntegrationOptions;

        this.integration = new AwsIntegration({
            service: 'events',
            action: 'PutEvents',
            integrationHttpMethod: 'POST',
            options: options
          });
          
    }
}
