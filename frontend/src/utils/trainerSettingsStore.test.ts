import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySyncData } from './srsSyncData';
import { getAccountSettingValue, setAccountTrainerSettings, updateAccountSetting } from './trainerSettingsStore';

describe('account trainer settings store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads account preferences instead of local storage representations', () => {
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    const settings = emptySyncData().settings;
    settings.wordsCategories = ['cat-1'];
    settings.trainerPrefs.words.directionMode = 'de_to_ru';
    settings.trainerPrefs.numbers.range = { min: 20, max: 500 };
    settings.trainerPrefs.srs.words = false;
    setAccountTrainerSettings(settings, 'learner-1');

    expect(getAccountSettingValue('words_settings')).toMatchObject({
      directionMode: 'de_to_ru',
      selectedCats: ['cat-1'],
    });
    expect(getAccountSettingValue('numbers_range')).toEqual({ min: 20, max: 500 });
    expect(getAccountSettingValue('words_use_srs')).toBe(false);
  });

  it('updates and timestamps account settings in memory', () => {
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    const settings = emptySyncData().settings;
    setAccountTrainerSettings(settings, 'learner-1');
    const originalSettings = structuredClone(settings);
    updateAccountSetting('time_display_mode', 'digital');
    updateAccountSetting('verbs_praesens_submode', 'form_to_infinitive');

    expect(settings).toEqual(originalSettings);
    expect(getAccountSettingValue('time_display_mode')).toBe('digital');
    expect(getAccountSettingValue('verbs_praesens_submode')).toBe('form_to_infinitive');
  });
});
