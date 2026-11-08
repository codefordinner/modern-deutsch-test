import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import { isPrismaError } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema } from '../validation';

const router = Router();
const normalizeCategoryName = (value: string): string => value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

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
    res.status(500).json({ error: 'Не удалось загрузить категории' });
  }
});

router.post('/', requireAdmin, validate(createCategorySchema), async (req: Request, res: Response) => {
  try {
    const { name, icon, color, isBuiltin } = req.body as import('../validation').CreateCategoryBody;
    const normalizedName = normalizeCategoryName(name);
    if (await prisma.category.findFirst({ where: { normalizedName } })) {
      return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        normalizedName,
        icon: icon || '📌',
        color: color || '#2563eb',
        isBuiltin: Boolean(isBuiltin),
      },
    });
    res.status(201).json(category);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    res.status(500).json({ error: 'Не удалось создать категорию' });
  }
});

router.put('/:id', requireAdmin, validate(updateCategorySchema), async (req: Request, res: Response) => {
  try {
    const { name, icon, color } = req.body as import('../validation').UpdateCategoryBody;
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'Название категории некорректно' });
    if (typeof name === 'string') {
      const normalizedName = normalizeCategoryName(name);
      if (await prisma.category.findFirst({ where: { normalizedName, NOT: { id: req.params.id } } })) {
        return res.status(409).json({ error: 'Категория с таким названием уже существует' });
      }
    }
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim(), normalizedName: normalizeCategoryName(name) }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
      },
    });
    res.json(category);
  } catch (error) {
    if (isPrismaError(error, 'P2025')) return res.status(404).json({ error: 'Категория не найдена' });
    if (isPrismaError(error, 'P2002')) return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    res.status(500).json({ error: 'Не удалось обновить категорию' });
  }
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const cat = await prisma.category.findUnique({ where: { id } });
    if (!cat) return res.status(404).json({ error: 'Категория не найдена' });
    if (cat.isBuiltin) {
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
    if (isPrismaError(error, 'P2025')) return res.status(404).json({ error: 'Категория не найдена' });
    res.status(500).json({ error: 'Не удалось удалить категорию' });
  }
});

export default router;
