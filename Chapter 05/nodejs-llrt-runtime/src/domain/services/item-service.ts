import { IDatabase } from "../repositories/database";
import { Item } from "../entities/item";
import { inject, injectable } from "tsyringe";

@injectable()
class ItemService {
  constructor(
    @inject("IDatabase") private readonly itemRepository: IDatabase<Item>) {}

  Create = async (item: Item): Promise<Item> => {
    const existingClassiified =  await this.itemRepository.Find(item.id);
    
    if( existingClassiified ) 
      throw new Error('Already exists');

    return await this.itemRepository.Save(item);
  }

  Publish = async (itemId: string): Promise<Item> => {
    const existingClassiified =  await this.itemRepository.Find(itemId);
    
    if( existingClassiified?.isPending() ) {
      existingClassiified.Online()
      return await this.itemRepository.Save(existingClassiified);
    }
    throw new Error('Invalid status');
  }
}

export { ItemService as ItemService }