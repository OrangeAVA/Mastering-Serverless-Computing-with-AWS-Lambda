import { SQSEvent } from "aws-lambda";
import { QueryCommand, DynamoDBClient, QueryCommandInput, BatchWriteItemCommand, BatchWriteItemCommandInput } from '@aws-sdk/client-dynamodb';
import { AssignmentRepository } from "./assignment-repository";

const repository = new AssignmentRepository(new DynamoDBClient({ region: process.env.AWS_REGION }));

export const handler = async(event: SQSEvent) => {
  console.log(JSON.stringify(event, null, 2));

  await Promise.all(event.Records.map(async(record) => {
    const { body } = record;
    const { category, message, ticketId } = JSON.parse(body);

    // Find the next available Staff with no assignment for the category this is ordered to fetch the staff with oldest assignment
    const staff = await repository.findAvailableStaffForCategory(category);
    console.log("AVAILABLE Staff Fetch result: ", JSON.stringify(staff, null, 2));
    let assignments = parseInt(staff?.assignments ?? "0");
    let staffId;

    if(!staff) {
      staffId = `${Math.floor(Math.random() * (100 - 1 + 1) + 1)}`;
      console.log("Assigning Ticket to new Staff : ", { staffId, category, assignments, ticketId: ticketId, message });
      await repository.assignTicketAndSetStaffAssignmentCount(category, staffId, ++assignments, ticketId, message)
    }
    else {
      staffId = staff.staffId;
      console.log("Assigning Ticket to existing Staff : ", { staffId, category, assignments, ticketId, message });
      await repository.assignTicket(category, staffId, ++assignments, staff, ticketId, message);
    }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Hello from assignment handler'
    })
  }
};