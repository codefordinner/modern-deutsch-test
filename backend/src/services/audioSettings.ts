import { prisma } from '../db';

export const AUDIO_SETTINGS_KEY = 'audioSettings';
/** Kept for compatibility with code/configuration that referred to the old key. */
export const AUDIO_VOICE_SETTING_KEY = AUDIO_SETTINGS_KEY;
export const DEFAULT_AUDIO_VOICE = process.env.PIPER_VOICE || 'de_DE-thorsten-medium';

// The Piper container must have the selected model available. Keep this list
// deliberately small and explicit instead of accepting arbitrary user input.
export const AUDIO_VOICES = ['de_DE-thorsten-medium', 'de_DE-thorsten-high'] as const;
export type AudioVoice = (typeof AUDIO_VOICES)[number];

export interface AudioSettings {
  voice: AudioVoice;
  /** Piper: duration multiplier. Lower is faster, higher is slower. */
  lengthScale: number;
  /** Piper: phoneme noise / prosody variation. */
  noiseScale: number;
  /** Piper: noise used for phoneme duration variation. */
  noiseWScale: number;
  /** Silence inserted between sentences, in seconds. */
  sentenceSilence: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  voice: isAudioVoice(DEFAULT_AUDIO_VOICE) ? DEFAULT_AUDIO_VOICE : 'de_DE-thorsten-medium',
  lengthScale: 1,
  noiseScale: 0.667,
  noiseWScale: 0.8,
  sentenceSilence: 0,
};

const numberInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function sanitizeAudioSettings(value: unknown): AudioSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!isAudioVoice(raw.voice) || !numberInRange(raw.lengthScale, 0.1, 3) ||
      !numberInRange(raw.noiseScale, 0, 2) || !numberInRange(raw.noiseWScale, 0, 2) ||
      !numberInRange(raw.sentenceSilence, 0, 10)) return null;
  return {
    voice: raw.voice,
    lengthScale: raw.lengthScale,
    noiseScale: raw.noiseScale,
    noiseWScale: raw.noiseWScale,
    sentenceSilence: raw.sentenceSilence,
  };
}

export function isAudioVoice(value: unknown): value is AudioVoice {
  return typeof value === 'string' && (AUDIO_VOICES as readonly string[]).includes(value);
}

export async function readAudioSettings(): Promise<{ settings: AudioSettings; isDefault: boolean }> {
  const row = await prisma.setting.findUnique({ where: { key: AUDIO_SETTINGS_KEY } });
  const legacyRow = row ? null : await prisma.setting.findUnique({ where: { key: 'audioVoice' } });
  if (row || legacyRow) {
    const stored = row ?? legacyRow!;
    try {
      const parsed = sanitizeAudioSettings(JSON.parse(stored.value));
      if (parsed) return { settings: parsed, isDefault: false };
      // Migrate the previous format, which stored only the model name as a string.
      if (isAudioVoice(stored.value)) return { settings: { ...DEFAULT_AUDIO_SETTINGS, voice: stored.value }, isDefault: false };
    } catch { /* use defaults */ }
  }
  return { settings: DEFAULT_AUDIO_SETTINGS, isDefault: true };
}

export async function writeAudioSettings(settings: AudioSettings): Promise<void> {
  await prisma.setting.upsert({
    where: { key: AUDIO_SETTINGS_KEY },
    create: { key: AUDIO_SETTINGS_KEY, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  });
}

export async function resetAudioSettings(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: AUDIO_SETTINGS_KEY, } });
}

export const readAudioVoice = async () => {
  const result = await readAudioSettings();
  return { voice: result.settings.voice, isDefault: result.isDefault };
};
export const writeAudioVoice = (voice: AudioVoice) => writeAudioSettings({ ...DEFAULT_AUDIO_SETTINGS, voice });
export const resetAudioVoice = resetAudioSettings;
