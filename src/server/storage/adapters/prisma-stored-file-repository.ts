import { prisma } from '@/server/shared/prisma/client'
import type { StoredFileRepository } from '../ports/stored-file-repository'

const select = { id: true, key: true, contentType: true, size: true, sha256: true, kind: true, originalName: true } as const

export const prismaStoredFileRepository: StoredFileRepository = {
  create: (record) => prisma.storedFile.create({ data: record, select }),
  findById: (id) => prisma.storedFile.findUnique({ where: { id }, select }),
  findByOriginalName: (kind, originalName) => prisma.storedFile.findFirst({ where: { kind, originalName }, select }),
}
