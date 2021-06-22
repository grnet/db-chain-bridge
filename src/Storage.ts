
export type StorageEntry = {id: string} & unknown;

export interface StorageInterface {
  create: (type: string, data: unknown)=> Promise<StorageEntry>;
  getBy: (type: string, query: unknown)=> Promise<StorageEntry>;
  update: (type: string, id:string, data: unknown)=> Promise<StorageEntry>;
}


