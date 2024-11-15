import { BatchWriteItemCommand, BatchWriteItemCommandInput, DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

export class AssignmentRepository {
  constructor(private readonly client: DynamoDBClient) {}

  findAvailableStaffForCategory = async (category: string) => {
    const query = {
      TableName: process.env.TABLE_NAME,
      Limit: 10,
      ScanIndexForward: true,
      KeyConditionExpression: "#PK = :PK and begins_with(#SK, :SK)",
      ExpressionAttributeNames: {
        "#PK": "PK",
        "#SK": "SK",
      },
      ExpressionAttributeValues: {
        ":PK": { S: 'AVAILABLE' },
        ":SK": { S: `CATEGORY#${category}#` },
      },
    };

    const result = (await this.client.send(new QueryCommand(query)))?.Items?.[0];
    if(result) return unmarshall(result);
    return null;
  }

  assignTicket = async (category: string, staffId: string, assignments: number, lastStaffStatus: any, ticketId: string, message: string) => {
    console.log("Assigning Ticket to existing Staff : ", { lastStaffStatus, staffId, category, assignments, ticketId, message })
    const input = {
      RequestItems: {
        [`${process.env.TABLE_NAME}`]: [
          {
            PutRequest: {
              Item: {
                PK: { S: `OCCUPIED` },
                SK: { S: `CATEGORY#${category}#TIME#${new Date().getTime()}#STAFF#${staffId}` },
                category: { S: category },
                assignments: { N: `${assignments}`},
                staffId: { S: staffId },
                assignedAt: { S: new Date().toISOString() }
              }
            }
          },
          {
            DeleteRequest: {
              Key: {
                PK: { S: "AVAILABLE" },
                SK: { S: lastStaffStatus.SK }
              }
            }
          },
          {
            PutRequest: {
              Item: {
                PK: { S: `OCCUPIED` },
                SK: { S: `CATEGORY#${category}#TICKET#${ticketId}` },
                category: { S: category },
                staffId: { S: staffId },
                ticketId: { S: `${ticketId}` },
                message: { S: message },
                assignedAt: { S: new Date().toISOString() }
              },
            },
          },
        ],
      },
    } satisfies BatchWriteItemCommandInput;

    await this.client.send(new BatchWriteItemCommand(input));
  }

  assignTicketAndSetStaffAssignmentCount = async (category: string, staffId: string, assignments: number, ticketId: string, message: string) => {
    const input = {
      RequestItems: {
        [`${process.env.TABLE_NAME}`]: [
          {
            PutRequest: {
              Item: {
                PK: { S: `OCCUPIED` },
                SK: { S: `CATEGORY#${category}#TIME#${new Date().getTime()}#STAFF#${staffId}` },
                category: { S: category },
                assignments: { N: `${assignments}`},
                staffId: { S: staffId },
                assignedAt: { S: new Date().toISOString() }
              },
            },
          },
          {
            PutRequest: {
              Item: {
                PK: { S: `OCCUPIED` },
                SK: { S: `CATEGORY#${category}#TICKET#${ticketId}` },
                category: { S: category },
                staffId: { S: staffId },
                ticketId: { S: `${ticketId}` },
                message: { S: message },
                assignedAt: { S: new Date().toISOString() }
              },
            },
          },
        ],
      },
    } satisfies BatchWriteItemCommandInput;

    await this.client.send(new BatchWriteItemCommand(input));
  }

  releaseAssignment = async (category: string, staffId: string) => {
    const input = {
      RequestItems: {
        [`${process.env.TABLE_NAME}`]: [
          {
            PutRequest: {
              Item: {
                PK: { S: `AVAILABLE` },
                SK: { S: `CATEGORY#${category}#ASSIGNMENT#0#` },
                category: { S: category },
                assignments: { N: `0` },
                assignedAt: { S: new Date().toISOString() },
              },
            },
          },
          {
            DeleteRequest: {
              Key: {
                PK: { S: `OCCUPIED` },
                SK: { S: `CATEGORY#${category}#ASSIGNMENT#0#STAFF#${staffId}` },
              },
            },
          },
        ],
      },
    };

    return this.client.send(new BatchWriteItemCommand(input));
  }
}