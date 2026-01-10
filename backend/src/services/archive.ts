import { prisma } from '../db';

/**
 * Enforce automatic archival rules:
 * - Todos: archive when dueDate < now - 12 hours (and not completed)
 *
 * This is "on-read" enforcement: call before returning lists.
 */
export async function enforceArchiveRules(userId: string): Promise<void> {
  const now = new Date();
  const overdueCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  // Overdue todos (12h past dueDate)
  await prisma.actionableItem.updateMany({
    where: {
      userId,
      archivedAt: null,
      completed: false,
      dueDate: { not: null, lt: overdueCutoff },
    },
    data: {
      archivedAt: now,
      archivedReason: 'overdue_12h',
    },
  });
}


