import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { TicketRepository } from "./ticket-repository";
import { InternalException, TicketAlreadyExistException } from "./exception";

const repository = new TicketRepository(new DynamoDBClient({ region: process.env.AWS_REGION }));
export const handler = async(event: APIGatewayProxyEvent) => {
  
    if( !event.body )
        return {
          statusCode: 400,
          body: JSON.stringify({message: 'The request body is empty'})
        }

    try {
        const { category, message, ticketId } = JSON.parse(event.body);
        await repository.createTicket(category, ticketId, message)

        return {
          statusCode: 201,
          body: JSON.stringify({
            message: 'Hello from Add Ticket handler'
          })
        }
    } catch (error: InternalException) {
    if ( error instanceof TicketAlreadyExistException) {
      return {
        statusCode: 400,
        body: JSON.stringify({message: error.message})
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({message: 'Internal Server Error'})
    }
  }
};