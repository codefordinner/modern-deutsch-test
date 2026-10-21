import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// hilfsverb is stored as the canonical 'haben' | 'sein' (NOT the conjugated 'hat' / 'ist'):
// the admin form, the import and the verbs trainer all compare against exactly these values.
type VerbRow = [
  de: string, ru: string, praeteritum: string, partizip2: string, hilfsverb: 'haben' | 'sein',
  ich: string, du: string, erSieEs: string, wir: string, ihr: string, sie: string,
];

const VERBS: VerbRow[] = [
  ['sein', 'быть', 'war', 'gewesen', 'sein', 'bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
  ['haben', 'иметь', 'hatte', 'gehabt', 'haben', 'habe', 'hast', 'hat', 'haben', 'habt', 'haben'],
  ['gehen', 'идти, ходить', 'ging', 'gegangen', 'sein', 'gehe', 'gehst', 'geht', 'gehen', 'geht', 'gehen'],
  ['sprechen', 'говорить', 'sprach', 'gesprochen', 'haben', 'spreche', 'sprichst', 'spricht', 'sprechen', 'sprecht', 'sprechen'],
  ['sehen', 'видеть, смотреть', 'sah', 'gesehen', 'haben', 'sehe', 'siehst', 'sieht', 'sehen', 'seht', 'sehen'],
  ['kommen', 'приходить, приезжать', 'kam', 'gekommen', 'sein', 'komme', 'kommst', 'kommt', 'kommen', 'kommt', 'kommen'],
  ['machen', 'делать', 'machte', 'gemacht', 'haben', 'mache', 'machst', 'macht', 'machen', 'macht', 'machen'],
  ['lesen', 'читать', 'las', 'gelesen', 'haben', 'lese', 'liest', 'liest', 'lesen', 'lest', 'lesen'],
  ['schreiben', 'писать', 'schrieb', 'geschrieben', 'haben', 'schreibe', 'schreibst', 'schreibt', 'schreiben', 'schreibt', 'schreiben'],
  ['essen', 'есть, кушать', 'aß', 'gegessen', 'haben', 'esse', 'isst', 'isst', 'essen', 'esst', 'essen'],
];

type NounRow = { de: string; ru: string; plural: string; feminine?: string; femininePlural?: string; cat: 'daily' | 'family' };

const NOUNS: NounRow[] = [
  { de: 'das Haus', ru: 'дом', plural: 'die Häuser', cat: 'daily' },
  { de: 'das Buch', ru: 'книга', plural: 'die Bücher', cat: 'daily' },
  { de: 'der Tisch', ru: 'стол', plural: 'die Tische', cat: 'daily' },
  { de: 'die Stadt', ru: 'город', plural: 'die Städte', cat: 'daily' },
  { de: 'die Zeit', ru: 'время', plural: 'die Zeiten', cat: 'daily' },
  { de: 'die Mutter', ru: 'мама, мать', plural: 'die Mütter', cat: 'family' },
  { de: 'der Vater', ru: 'папа, отец', plural: 'die Väter', cat: 'family' },
  { de: 'das Kind', ru: 'ребёнок', plural: 'die Kinder', cat: 'family' },
  { de: 'der Freund', ru: 'друг', plural: 'die Freunde', feminine: 'die Freundin', femininePlural: 'die Freundinnen', cat: 'family' },
];

async function main() {
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    console.log(`Database already contains ${existingCategories} categories. Skipping seed.`);
    return;
  }

  console.log('Seeding initial categories and words...');

  const verbsCategory = await prisma.category.create({
    data: { name: 'Глаголы (A1–A2)', icon: '⚡', color: '#10b981', isBuiltin: true },
  });
  const dailyCategory = await prisma.category.create({
    data: { name: 'Повседневные слова', icon: '☕', color: '#3b82f6', isBuiltin: true },
  });
  const familyCategory = await prisma.category.create({
    data: { name: 'Семья и люди', icon: '👥', color: '#8b5cf6', isBuiltin: false },
  });

  for (const [de, ru, praeteritum, partizip2, hilfsverb, ich, du, erSieEs, wir, ihr, sie] of VERBS) {
    await prisma.word.create({
      data: {
        de, ru, partOfSpeech: 'verb', praeteritum, partizip2, hilfsverb,
        praesensIch: ich, praesensDu: du, praesensErSieEs: erSieEs, praesensWir: wir, praesensIhr: ihr, praesensSie: sie,
        categoryId: verbsCategory.id,
      },
    });
  }

  for (const { cat, ...noun } of NOUNS) {
    await prisma.word.create({
      data: { ...noun, partOfSpeech: 'noun', categoryId: cat === 'daily' ? dailyCategory.id : familyCategory.id },
    });
  }

  console.log(`Seeded ${VERBS.length + NOUNS.length} starter words successfully.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
