import express from 'express';
import cors from 'cors';
import apiRouter from './api';
import { backfillPartOfSpeech } from './services/backfillPartOfSpeech';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  backfillPartOfSpeech().catch((error) => console.error('[partOfSpeech] backfill failed:', error));
});
