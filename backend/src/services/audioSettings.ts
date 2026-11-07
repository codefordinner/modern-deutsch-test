import { prisma } from '../db';

export const AUDIO_VOICE_SETTING_KEY = 'audioVoice';
export const DEFAULT_AUDIO_VOICE = process.env.PIPER_VOICE || 'de_DE-thorsten-medium';

// The Piper container must have the selected model available. Keep this list
// deliberately small and explicit instead of accepting arbitrary user input.
export const AUDIO_VOICES = ['de_DE-thorsten-medium', 'de_DE-thorsten-high'] as const;
export type AudioVoice = (typeof AUDIO_VOICES)[number];

export function isAudioVoice(value: unknown): value is AudioVoice {
  return typeof value === 'string' && (AUDIO_VOICES as readonly string[]).includes(value);
}

export async function readAudioVoice(): Promise<{ voice: AudioVoice; isDefault: boolean }> {
  const row = await prisma.setting.findUnique({ where: { key: AUDIO_VOICE_SETTING_KEY } });
  if (row && isAudioVoice(row.value)) return { voice: row.value, isDefault: false };
  const fallback = isAudioVoice(DEFAULT_AUDIO_VOICE) ? DEFAULT_AUDIO_VOICE : 'de_DE-thorsten-medium';
  return { voice: fallback, isDefault: true };
}

export async function writeAudioVoice(voice: AudioVoice): Promise<void> {
  await prisma.setting.upsert({
    where: { key: AUDIO_VOICE_SETTING_KEY },
    create: { key: AUDIO_VOICE_SETTING_KEY, value: voice },
    update: { value: voice },
  });
}

export async function resetAudioVoice(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: AUDIO_VOICE_SETTING_KEY } });
}
