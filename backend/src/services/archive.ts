import { prisma } from '../db';

/**
 * Enforce automatic archival rules:
 * - Info items: archive when expiresAt < now
 * - Todos: archive when dueDate < now - 12 hours (and not completed)
 *
 * This is "on-read" enforcement: call before returning lists.
 */
export async function enforceArchiveRules(userId: string): Promise<void> {
  const now = new Date();
  const overdueCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  // Expired infos
  await prisma.actionableItem.updateMany({
    where: {
      userId,
      archivedAt: null,
      kind: 'info',
      expiresAt: { not: null, lt: now },
    },
    data: {
      archivedAt: now,
      archivedReason: 'expired',
    },
  });

  // Overdue todos (12h past dueDate)
  await prisma.actionableItem.updateMany({
    where: {
      userId,
      archivedAt: null,
      kind: 'todo',
      completed: false,
      dueDate: { not: null, lt: overdueCutoff },
    },
    data: {
      archivedAt: now,
      archivedReason: 'overdue_12h',
    },
  });
}


