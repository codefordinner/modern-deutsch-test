import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { words: true, extraWords: true } } },
      orderBy: { name: 'asc' },
    });
    // A word is counted once per category it belongs to (as its primary or as an additional one).
    res.json(
      categories.map(({ _count, ...category }) => ({
        ...category,
        _count: { words: _count.words + _count.extraWords },
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, icon, color, isBuiltin } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const category = await prisma.category.create({
      data: {
        name,
        icon: icon || '📌',
        color: color || '#2563eb',
        isBuiltin: Boolean(isBuiltin),
      },
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, icon, color } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
      },
    });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const cat = await prisma.category.findUnique({ where: { id } });
    if (cat?.isBuiltin) {
      return res.status(400).json({ error: 'Встроенную категорию нельзя удалить' });
    }

    // Words whose PRIMARY category this is are deleted with it (cascade) — except those that also
    // belong to other categories: one of those becomes the new primary and the word survives.
    const owned = await prisma.word.findMany({
      where: { categoryId: id },
      select: { id: true, extraCategories: { select: { id: true } } },
    });
    const rescue = owned
      .filter((w) => w.extraCategories.length > 0)
      .map((w) =>
        prisma.word.update({
          where: { id: w.id },
          data: {
            category: { connect: { id: w.extraCategories[0].id } },
            extraCategories: { set: w.extraCategories.slice(1).map((c) => ({ id: c.id })) },
          },
        })
      );

    await prisma.$transaction([...rescue, prisma.category.delete({ where: { id } })]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
