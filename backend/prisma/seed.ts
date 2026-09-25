import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    console.log(`Database already contains ${existingCategories} categories. Skipping seed.`);
    return;
  }

  console.log('Seeding initial categories and words...');

  const verbsCategory = await prisma.category.create({
    data: {
      name: 'Глаголы (A1–A2)',
      icon: '⚡',
      color: '#10b981',
      isBuiltin: true,
    },
  });

  const dailyCategory = await prisma.category.create({
    data: {
      name: 'Повседневные слова',
      icon: '☕',
      color: '#3b82f6',
      isBuiltin: true,
    },
  });

  const familyCategory = await prisma.category.create({
    data: {
      name: 'Семья и люди',
      icon: '👥',
      color: '#8b5cf6',
      isBuiltin: false,
    },
  });

  // Seed sample verbs with full conjugations
  const verbsData = [
    {
      de: 'sein',
      ru: 'быть',
      partOfSpeech: 'verb',
      praeteritum: 'war',
      partizip2: 'gewesen',
      hilfsverb: 'ist',
      praesensIch: 'bin',
      praesensDu: 'bist',
      praesensErSieEs: 'ist',
      praesensWir: 'sind',
      praesensIhr: 'seid',
      praesensSie: 'sind',
      categoryId: verbsCategory.id,
    },
    {
      de: 'haben',
      ru: 'иметь',
      partOfSpeech: 'verb',
      praeteritum: 'hatte',
      partizip2: 'gehabt',
      hilfsverb: 'hat',
      praesensIch: 'habe',
      praesensDu: 'hast',
      praesensErSieEs: 'hat',
      praesensWir: 'haben',
      praesensIhr: 'habt',
      praesensSie: 'haben',
      categoryId: verbsCategory.id,
    },
    {
      de: 'gehen',
      ru: 'идти, ходить',
      partOfSpeech: 'verb',
      praeteritum: 'ging',
      partizip2: 'gegangen',
      hilfsverb: 'ist',
      praesensIch: 'gehe',
      praesensDu: 'gehst',
      praesensErSieEs: 'geht',
      praesensWir: 'gehen',
      praesensIhr: 'geht',
      praesensSie: 'gehen',
      categoryId: verbsCategory.id,
    },
    {
      de: 'sprechen',
      ru: 'говорить',
      partOfSpeech: 'verb',
      praeteritum: 'sprach',
      partizip2: 'gesprochen',
      hilfsverb: 'hat',
      praesensIch: 'spreche',
      praesensDu: 'sprichst',
      praesensErSieEs: 'spricht',
      praesensWir: 'sprechen',
      praesensIhr: 'sprecht',
      praesensSie: 'sprechen',
      categoryId: verbsCategory.id,
    },
    {
      de: 'sehen',
      ru: 'видеть, смотреть',
      partOfSpeech: 'verb',
      praeteritum: 'sah',
      partizip2: 'gesehen',
      hilfsverb: 'hat',
      praesensIch: 'sehe',
      praesensDu: 'siehst',
      praesensErSieEs: 'sieht',
      praesensWir: 'sehen',
      praesensIhr: 'seht',
      praesensSie: 'sehen',
      categoryId: verbsCategory.id,
    },
    {
      de: 'kommen',
      ru: 'приходить, приезжать',
      partOfSpeech: 'verb',
      praeteritum: 'kam',
      partizip2: 'gekommen',
      hilfsverb: 'ist',
      praesensIch: 'komme',
      praesensDu: 'kommst',
      praesensErSieEs: 'kommt',
      praesensWir: 'kommen',
      praesensIhr: 'kommt',
      praesensSie: 'kommen',
      categoryId: verbsCategory.id,
    },
    {
      de: 'machen',
      ru: 'делать',
      partOfSpeech: 'verb',
      praeteritum: 'machte',
      partizip2: 'gemacht',
      hilfsverb: 'hat',
      praesensIch: 'mache',
      praesensDu: 'machst',
      praesensErSieEs: 'macht',
      praesensWir: 'machen',
      praesensIhr: 'macht',
      praesensSie: 'machen',
      categoryId: verbsCategory.id,
    },
    {
      de: 'lesen',
      ru: 'читать',
      partOfSpeech: 'verb',
      praeteritum: 'las',
      partizip2: 'gelesen',
      hilfsverb: 'hat',
      praesensIch: 'lese',
      praesensDu: 'liest',
      praesensErSieEs: 'liest',
      praesensWir: 'lesen',
      praesensIhr: 'lest',
      praesensSie: 'lesen',
      categoryId: verbsCategory.id,
    },
    {
      de: 'schreiben',
      ru: 'писать',
      partOfSpeech: 'verb',
      praeteritum: 'schrieb',
      partizip2: 'geschrieben',
      hilfsverb: 'hat',
      praesensIch: 'schreibe',
      praesensDu: 'schreibst',
      praesensErSieEs: 'schreibt',
      praesensWir: 'schreiben',
      praesensIhr: 'schreibt',
      praesensSie: 'schreiben',
      categoryId: verbsCategory.id,
    },
    {
      de: 'essen',
      ru: 'есть, кушать',
      partOfSpeech: 'verb',
      praeteritum: 'aß',
      partizip2: 'gegessen',
      hilfsverb: 'hat',
      praesensIch: 'esse',
      praesensDu: 'isst',
      praesensErSieEs: 'isst',
      praesensWir: 'essen',
      praesensIhr: 'esst',
      praesensSie: 'essen',
      categoryId: verbsCategory.id,
    },
  ];

  for (const v of verbsData) {
    await prisma.word.create({ data: v });
  }

  const nounData = [
    {
      de: 'das Haus',
      ru: 'дом',
      plural: 'die Häuser',
      partOfSpeech: 'noun',
      categoryId: dailyCategory.id,
    },
    {
      de: 'das Buch',
      ru: 'книга',
      plural: 'die Bücher',
      partOfSpeech: 'noun',
      categoryId: dailyCategory.id,
    },
    {
      de: 'der Tisch',
      ru: 'стол',
      plural: 'die Tische',
      partOfSpeech: 'noun',
      categoryId: dailyCategory.id,
    },
    {
      de: 'die Stadt',
      ru: 'город',
      plural: 'die Städte',
      partOfSpeech: 'noun',
      categoryId: dailyCategory.id,
    },
    {
      de: 'die Zeit',
      ru: 'время',
      plural: 'die Zeiten',
      partOfSpeech: 'noun',
      categoryId: dailyCategory.id,
    },
    {
      de: 'die Mutter',
      ru: 'мама, мать',
      plural: 'die Mütter',
      partOfSpeech: 'noun',
      categoryId: familyCategory.id,
    },
    {
      de: 'der Vater',
      ru: 'папа, отец',
      plural: 'die Väter',
      partOfSpeech: 'noun',
      categoryId: familyCategory.id,
    },
    {
      de: 'das Kind',
      ru: 'ребёнок',
      plural: 'die Kinder',
      partOfSpeech: 'noun',
      categoryId: familyCategory.id,
    },
    {
      de: 'der Freund',
      ru: 'друг',
      plural: 'die Freunde',
      feminine: 'die Freundin',
      femininePlural: 'die Freundinnen',
      partOfSpeech: 'noun',
      categoryId: familyCategory.id,
    },
  ];

  for (const n of nounData) {
    await prisma.word.create({ data: n });
  }

  console.log(`Seeded ${verbsData.length + nounData.length} starter words successfully.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
