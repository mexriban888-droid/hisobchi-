import { Router } from 'express';
import { z } from 'zod';
import { prisma, requireUser, requireActive } from './access.js';
import { buildReport, periods, reportRange } from './analytics.js';
const router = Router();
router.get('/report', requireUser, requireActive, async (req, res, next) => {
  try {
    const query = z.object({ period: z.enum(periods).default('MONTH'), from: z.string().optional(), to: z.string().optional() }).parse(req.query);
    const now = new Date(), range = reportRange(query.period, now, query.from, query.to);
    const rows = await prisma.transaction.findMany({ where: { userId: req.user!.id, occurredAt: { gte: range.previousFrom, lt: range.until, lte: now } }, select: { id: true, type: true, amountUzs: true, amountUsdSnapshot: true, occurredAt: true, categoryId: true, category: { select: { name: true } }, comment: true }, orderBy: { occurredAt: 'asc' } });
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildReport(rows, range, now));
  } catch (error) { next(error); }
});
export default router;
