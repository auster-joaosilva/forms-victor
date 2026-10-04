import type { LegacyImage } from '../domain/event-mapping'

export interface LegacyImageStore {
  find(kind: LegacyImage['kind'], key: string): Promise<string | null>
  store(image: LegacyImage): Promise<string>
  houseFileId(name: string): Promise<string | null>
}
