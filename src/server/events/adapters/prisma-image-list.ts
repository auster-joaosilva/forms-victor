import { prisma } from '@/server/shared/prisma/client'
import type { GalleryItem } from '../ports/image-store'

export async function listEventImages(): Promise<{ id: string; kind: GalleryItem['kind']; originalName: string | null }[]> {
  return prisma.storedFile.findMany({
    where: { kind: { in: ['house_photo', 'event_cover', 'speaker_photo'] } },
    orderBy: [{ kind: 'asc' }, { originalName: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, kind: true, originalName: true },
  })
}
