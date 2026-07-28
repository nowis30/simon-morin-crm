import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function writeAuditLog(input: {
  userId?: string;
  entity: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}