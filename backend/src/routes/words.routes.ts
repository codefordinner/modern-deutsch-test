import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { inferPartOfSpeech, isPartOfSpeech, readPartOfSpeech } from '../services/partOfSpeech';

const router = Router();

// SQLite's LIKE (which Prisma's `contains` compiles to) is case-insensitive only
// for ASCII, and neither Prisma's `mode: 'insensitive'` nor SQLite's lower()
// covers Cyrillic or umlauts (Ä/ä, Ö/ö, Ü/ü). So text search is done in JS with
// a Unicode-aware lowercase; the word list is small enough for that.
const normalizeForSearch = (value: string | null | undefined): string => (value ?? '').normalize('NFC').toLowerCase();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { categoryId, search, limit = '200', page = '1' } = req.query;
    const where: { categoryId?: string } = {};
    if (categoryId && categoryId !== 'all') where.categoryId = String(categoryId);

    const take = Math.min(Number(limit) || 200, 1000);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const query = search ? normalizeForSearch(String(search).trim()) : '';

    let words;
    let total: number;

    if (!query) {
      [words, total] = await Promise.all([
        prisma.word.findMany({ where, include: { category: true }, take, skip, orderBy: { de: 'asc' } }),
        prisma.word.count({ where }),
      ]);
    } else {
      const candidates = await prisma.word.findMany({ where, include: { category: true }, orderBy: { de: 'asc' } });
      const matched = candidates.filter((w) =>
        [w.de, w.ru, w.hint].some((field) => normalizeForSearch(field).includes(query))
      );
      total = matched.length;
      words = matched.slice(skip, skip + take);
    }

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

    const pos = readPartOfSpeech(req.body, { keepIfMissing: false });
    if (!pos.ok) return res.status(400).json({ error: pos.error });

    const word = await prisma.word.create({
      data: {
        de,
        ru,
        hint,
        partOfSpeech: pos.value,
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

    const pos = readPartOfSpeech(req.body, { keepIfMissing: true });
    if (!pos.ok) return res.status(400).json({ error: pos.error });

    const word = await prisma.word.update({
      where: { id: req.params.id },
      data: {
        de,
        ru,
        hint,
        partOfSpeech: pos.value,
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
    const { data, defaultCategoryId, partOfSpeech } = req.body;
    if (!data || !defaultCategoryId) return res.status(400).json({ error: 'Data and categoryId required' });

    // Optional: applies to every imported line; without it each line is inferred on its own (articles → noun).
    if (partOfSpeech && !isPartOfSpeech(partOfSpeech)) return res.status(400).json({ error: 'Invalid partOfSpeech' });

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
        await prisma.word.create({
          data: {
            de,
            ru,
            plural,
            hint,
            partOfSpeech: partOfSpeech || inferPartOfSpeech({ de }),
            categoryId: defaultCategoryId,
          },
        });
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
