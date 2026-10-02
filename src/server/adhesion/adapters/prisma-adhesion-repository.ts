import type { Prisma } from '@/server/shared/prisma/generated/client'
import type { AdhesionGetPayload, AdhesionWhereInput } from '@/server/shared/prisma/generated/models'
import { prisma } from '@/server/shared/prisma/client'
import {
  MODALITY_FROM_DB, MODALITY_TO_DB, WITHOUT_MANIFESTATION_FROM_DB, WITHOUT_MANIFESTATION_TO_DB,
  type AdhesionRecord,
} from '../domain/adhesion'
import type { CsvAdhesion } from '../domain/csv'
import type { AdhesionCounts, AdhesionFilter, AdhesionListItem, AdhesionRepository } from '../ports/adhesion-repository'

const include = { handledBy: { select: { username: true } } } as const

type Row = AdhesionGetPayload<{ include: typeof include }>

const toRecord = (row: Row): AdhesionRecord => ({
  id: row.id,
  protocol: row.protocol,
  acceptedAt: row.acceptedAt,
  empresa: {
    nomeEmpresa: row.companyName,
    cnpj: row.cnpj,
    representante: row.representative,
    cpf: row.cpf,
    cargo: row.representativeRole,
    email: row.email,
    telefone: row.phone ?? '',
  },
  modalidade: MODALITY_FROM_DB[row.modality],
  semManifestacao: row.withoutManifestation ? WITHOUT_MANIFESTATION_FROM_DB[row.withoutManifestation] : null,
  querProposta: row.wantsProposal,
  termVersion: row.termVersion,
  termHash: row.termHash,
  originIp: row.originIp,
})

const toListItem = (row: Row): AdhesionListItem => ({
  ...toRecord(row),
  status: row.status,
  handledBy: row.handledBy?.username ?? null,
  handledAt: row.handledAt,
})

const toCsvAdhesion = (row: Row): CsvAdhesion => {
  const { empresa, modalidade, semManifestacao, querProposta, termVersion, termHash, originIp, protocol, acceptedAt } = toRecord(row)
  return {
    protocol, acceptedAt, status: row.status, modalidade, semManifestacao, empresa, querProposta,
    responseId: row.responseId, invitationToken: row.invitationToken, termVersion, termHash, originIp,
    originSource: row.originSource, forwardedChain: row.forwardedChain, userAgent: row.userAgent,
    handledBy: row.handledBy?.username ?? null, handledAt: row.handledAt, internalNote: row.internalNote,
  }
}

function adhesionWhere({ status, modality, search }: AdhesionFilter): AdhesionWhereInput {
  const where: AdhesionWhereInput = {
    ...(status ? { status } : {}),
    ...(modality ? { modality: MODALITY_TO_DB[modality] } : {}),
  }
  const term = search?.trim()
  if (!term) return where
  const digits = term.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return {
    ...where,
    OR: [
      { companyName: { contains: term, mode: 'insensitive' } },
      { cnpj: { contains: term } },
      { protocol: { contains: term, mode: 'insensitive' } },
      { representative: { contains: term, mode: 'insensitive' } },
      ...(digits.length >= 2 ? [{ cnpjDigits: { contains: digits } }] : []),
    ],
  }
}

const newestFirst = [{ acceptedAt: 'desc' as const }, { id: 'desc' as const }]

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'

export const prismaAdhesionRepository: AdhesionRepository = {
  async create(input) {
    const { submission } = input
    // O convite pode ter sido apagado entre a busca e o insert; a chave estrangeira recusaria a adesão inteira.
    const knownInvitation = input.invitationToken ? await prisma.invitation.count({ where: { token: input.invitationToken } }) : 0
    try {
      const row = await prisma.adhesion.create({
        data: {
          protocol: input.protocol,
          receiptToken: input.receiptToken,
          responseId: input.responseId,
          invitationToken: knownInvitation ? input.invitationToken : null,
          acceptedAt: input.acceptedAt,
          companyName: submission.empresa.nomeEmpresa,
          cnpj: submission.empresa.cnpj,
          cnpjDigits: input.cnpjDigits,
          representative: submission.empresa.representante,
          cpf: submission.empresa.cpf,
          representativeRole: submission.empresa.cargo,
          email: submission.empresa.email,
          phone: submission.empresa.telefone,
          modality: MODALITY_TO_DB[submission.modalidade],
          withoutManifestation: submission.semManifestacao ? WITHOUT_MANIFESTATION_TO_DB[submission.semManifestacao] : null,
          wantsProposal: submission.querProposta,
          termVersion: input.termVersion,
          termHash: input.termHash,
          originIp: input.originIp,
          originSource: input.originSource,
          forwardedChain: input.forwardedChain,
          userAgent: input.userAgent,
          payload: input.payload as Prisma.InputJsonValue,
        },
        select: { id: true },
      })
      return { id: row.id }
    } catch (error) {
      if (isUniqueViolation(error)) return 'protocol_taken'
      throw error
    }
  },

  async findByReceiptToken(token) {
    if (!token) return null
    const row = await prisma.adhesion.findUnique({ where: { receiptToken: token }, include })
    return row ? toRecord(row) : null
  },

  async findById(id) {
    const row = await prisma.adhesion.findUnique({ where: { id }, include })
    return row ? { ...toRecord(row), status: row.status } : null
  },

  async list(filter, pageSize) {
    const where = adhesionWhere(filter)
    const page = Math.max(1, filter.page ?? 1)
    const [rows, total] = await prisma.$transaction([
      prisma.adhesion.findMany({ where, include, orderBy: newestFirst, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.adhesion.count({ where }),
    ])
    return { items: rows.map(toListItem), total }
  },

  async counts() {
    const counts: AdhesionCounts = { total: 0, standard: 0, hybrid: 0, received: 0, filed: 0, cancelled: 0, toFile: 0 }
    const groups = await prisma.adhesion.groupBy({ by: ['modality', 'status'], _count: { _all: true } })
    for (const { modality, status, _count } of groups) {
      counts.total += _count._all
      counts[modality] += _count._all
      counts[status] += _count._all
      if (modality === 'hybrid' && status === 'received') counts.toFile += _count._all
    }
    return counts
  },

  listForExport: async (filter, limit) =>
    (await prisma.adhesion.findMany({ where: adhesionWhere(filter), include, orderBy: newestFirst, take: limit })).map(toCsvAdhesion),

  async setStatus(id, status, actorId, at) {
    await prisma.adhesion.updateMany({ where: { id }, data: { status, handledById: actorId, handledAt: at } })
  },
}
