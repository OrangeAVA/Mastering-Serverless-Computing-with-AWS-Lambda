import { Item } from "../entities/item";

export interface IDatabase<T extends Item> {
  Save(model: T): Promise<T>;
  Find(id: string): Promise<T>;
}