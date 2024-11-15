export type ValidationErrorItem = {
    message: string,
    title: string,
}

export class ValidationErrors {
    constructor(
        private readonly errors: ValidationErrorItem[]= []
    ) { }

    CheckError = (fn: () => boolean, error: ValidationErrorItem): ValidationErrors => {
        if (fn()) {
            this.errors.push(error);
        }
        return this;
    }

    get Errors(): ValidationErrorItem[] {
        return this.errors;
    }
}
