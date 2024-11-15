import { ItemValidationException } from "../exceptions/exception";
import { Entity } from "./entity";

export class ItemStatus {
  static readonly SUSPENDED = 'suspended';
  static readonly VALIDATION_PENDING = 'validation_pending';
  static readonly ONLINE_PENDING = 'online_pending';
  static readonly ONLINE = 'online';
  static readonly SCAM = 'scam';
  static readonly BLOCKED = 'blocked';
  static readonly SOLD = 'sold';
  static readonly REFUSED = 'refused';
}

export interface IItem {
  id: string;
  reference: string;
  price: number;
  created_at: Date;
  updated_at: Date;
}

export class Item extends Entity<string> implements IItem {
  private status: string = ItemStatus.VALIDATION_PENDING;
  
  constructor(
    id: string,
    public readonly reference: string,
    public readonly price: number,
    public readonly created_at: Date = new Date(),
    public readonly updated_at: Date = new Date(),
  ) {
    super(id);

    this.validations
      .CheckError(() => price <= 0, { title: 'Price', message: 'Price must be greater than 0' })
      .CheckError(() => price > 1000000, { title: 'Price', message: 'Price must be less than 1000000' })
      .CheckError(() => !reference, { title: 'Reference', message: 'Reference is required' })
      .CheckError(() => reference.length < 3, { title: 'Reference', message: 'Reference must be greater than 3 characters' })
      .CheckError(() => reference.length > 100, { title: 'Reference', message: 'Reference must be less than 100 characters' });

    if ( this.validations.Errors?.length ) 
      throw new ItemValidationException(this.validations);

   }

  static create(
    id: string,
    reference: string,
    price: number,
    created_at: Date =  new Date(),
    updated_at: Date =  new Date()
  ): Item {
    return new Item(id, reference, price, created_at, updated_at);
  }

  Refused(): IItem {
    this.status = ItemStatus.REFUSED;
    return this;
  }

  Suspend(): IItem {
    this.status = ItemStatus.SUSPENDED;
    return this;
  }

  Block(): IItem {
    this.status = ItemStatus.BLOCKED;
    return this;
  }

  Validate(): IItem {
    this.status = ItemStatus.VALIDATION_PENDING;
    return this;
  }

  Online(): IItem {
    this.status = ItemStatus.ONLINE;
    return this;
  }

  Scam(): IItem {
    this.status = ItemStatus.SCAM;
    return this;
  }

  Sold(): IItem {
    this.status = ItemStatus.SOLD;
    return this;
  }
  
  getStatus(): string {
    return this.status;
  }

  isPending(): boolean {
    return this.status === ItemStatus.VALIDATION_PENDING;
  }
}