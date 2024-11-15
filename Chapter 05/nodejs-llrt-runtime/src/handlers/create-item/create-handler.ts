import { inject, injectable } from "tsyringe";
import { LambdaFunctionURLEvent } from "aws-lambda";
import { Item } from "../../domain/entities/item";
import { ActionResults, Result } from "../action-results";
import { ItemValidationException } from "../../domain/exceptions/exception";
import { ItemService } from "../../domain/services/item-service";
import { randomUUID } from "crypto";

@injectable()
class CreateItemHandler {
    constructor(
        @inject(ItemService) private readonly service: ItemService) 
    { }

    Invoke = async (event: LambdaFunctionURLEvent): Promise<Result> => {

        if( !event.body ) 
          throw new Error("Invalid request body");

        const request = JSON.parse(event.body);
        try {

            const item = new Item(
                randomUUID(), 
                request.reference, 
                request.price, 
                request.created_at, 
                request.updated_at);          

            const result = await this.service.Create(item);
            return ActionResults.Success({ id: result.id, status: result.getStatus() });
            
        } catch (exception: any) {
            console.error(exception);
        
            if(exception instanceof ItemValidationException)
                return ActionResults.BadRequest({ message: exception.message, errors: exception.Validations.Errors });

            if(exception instanceof Error)
                return ActionResults.BadRequest({ message: exception.message });
            
            return ActionResults.InternalServerError({});
        }
    }
}

export { CreateItemHandler };