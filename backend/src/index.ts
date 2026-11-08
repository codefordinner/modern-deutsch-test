import { createApp } from './app';
import { tuneSqlite } from './db';
import { backfillPartOfSpeech } from './services/backfillPartOfSpeech';
import { backfillNormalizedKeys } from './services/backfillNormalizedKeys';
import { resumeAudioRegeneration } from './services/audio';

const PORT = process.env.PORT || 3001;

// The container runs behind nginx: trust its X-Forwarded-For so per-IP limits
// (login) see the real client. Set TRUST_PROXY=0 when the backend is exposed directly.
const trustProxy = Number(process.env.TRUST_PROXY ?? 1);

const app = createApp();
if (trustProxy > 0) app.set('trust proxy', trustProxy);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // WAL + busy_timeout first, then the startup data fixes and the audio job.
  tuneSqlite()
    .catch((error) => console.error('[db] sqlite tuning failed:', error))
    .then(() => {
      backfillPartOfSpeech().catch((error) => console.error('[partOfSpeech] backfill failed:', error));
      backfillNormalizedKeys().catch((error) => console.error('[normalizedKeys] backfill failed:', error));
      resumeAudioRegeneration().catch((error) => console.error('[audio] regeneration resume failed:', error));
    });
});
