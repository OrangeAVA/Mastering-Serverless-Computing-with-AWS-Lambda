import { ValidationErrors } from "./validation-errors";

export class ItemValidationException extends Error {
    private static readonly defaultMessage = "Item validation failed";
    constructor(public readonly Validations: ValidationErrors) {
        super(ItemValidationException.defaultMessage);
        this.name = "ItemValidationException";
    }
}

export class ItemNotFoundException extends Error {
    private static readonly defaultMessage = "Item not found";
    constructor(message?: string) {
        super(message ?? ItemNotFoundException.defaultMessage);
        this.name = "ItemNotFoundException";
    }
}