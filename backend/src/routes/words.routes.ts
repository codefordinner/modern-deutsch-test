import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { categoryId, search, limit = '200', page = '1' } = req.query;
    const where: any = {};
    if (categoryId && categoryId !== 'all') where.categoryId = String(categoryId);
    if (search) {
      const q = String(search).trim();
      where.OR = [{ de: { contains: q } }, { ru: { contains: q } }, { hint: { contains: q } }];
    }

    const take = Math.min(Number(limit) || 200, 1000);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [words, total] = await Promise.all([
      prisma.word.findMany({ where, include: { category: true }, take, skip, orderBy: { de: 'asc' } }),
      prisma.word.count({ where }),
    ]);

    res.json({ words, total, page: Number(page), limit: take });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      de,
      ru,
      hint,
      plural,
      feminine,
      praeteritum,
      partizip2,
      hilfsverb,
      praesensIch,
      praesensDu,
      praesensErSieEs,
      praesensWir,
      praesensIhr,
      praesensSie,
      categoryId,
    } = req.body;
    if (!de || !ru || !categoryId) return res.status(400).json({ error: 'Missing required fields' });

    const word = await prisma.word.create({
      data: {
        de,
        ru,
        hint,
        plural,
        feminine,
        praeteritum,
        partizip2,
        hilfsverb,
        praesensIch,
        praesensDu,
        praesensErSieEs,
        praesensWir,
        praesensIhr,
        praesensSie,
        categoryId,
      },
      include: { category: true },
    });
    res.status(201).json(word);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create word' });
  }
});

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      de,
      ru,
      hint,
      plural,
      feminine,
      praeteritum,
      partizip2,
      hilfsverb,
      praesensIch,
      praesensDu,
      praesensErSieEs,
      praesensWir,
      praesensIhr,
      praesensSie,
      categoryId,
    } = req.body;
    const word = await prisma.word.update({
      where: { id: req.params.id },
      data: {
        de,
        ru,
        hint,
        plural,
        feminine,
        praeteritum,
        partizip2,
        hilfsverb,
        praesensIch,
        praesensDu,
        praesensErSieEs,
        praesensWir,
        praesensIhr,
        praesensSie,
        categoryId,
      },
      include: { category: true },
    });
    res.json(word);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update word' });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.word.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Word deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

router.post('/import', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { data, defaultCategoryId } = req.body;
    if (!data || !defaultCategoryId) return res.status(400).json({ error: 'Data and categoryId required' });

    const lines = String(data).split('\n');
    let importedCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const parts = line.split(/[\t,;]/).map((p) => p.trim());
      if (parts.length >= 2) {
        const de = parts[0];
        const ru = parts[1];
        const plural = parts[2] || null;
        const hint = parts[3] || null;
        await prisma.word.create({ data: { de, ru, plural, hint, categoryId: defaultCategoryId } });
        importedCount++;
      }
    }

    res.json({ success: true, importedCount });
  } catch (error) {
    res.status(500).json({ error: 'Import failed' });
  }
});

router.get('/export', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const words = await prisma.word.findMany({ include: { category: true } });
    res.json(words);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

export default router;
