import { describe, expect, it } from 'vitest';
import { normalisePortalData } from '../src/services/storage/validate';
import { createDefaultWidgetSettings } from '../src/widgets/defaults';
import {
  DEFAULT_FISH_COLOURS,
  MAX_FISH,
  resolveFishColours,
} from '../src/widgets/Fish/palette';
import type { FishSettings } from '../src/types';

describe('fish settings', () => {
  it('builds a complete default tank', () => {
    const settings = createDefaultWidgetSettings('fish');
    expect(settings.fishCount).toBe(4);
    expect(settings.colours).toHaveLength(4);
    expect(settings.colours.every((colour) => /^#[0-9a-f]{6}$/i.test(colour))).toBe(true);
    expect(settings).toMatchObject({
      speed: 'normal',
      water: 'reef',
      bubbles: true,
      plants: true,
      tall: false,
    });
  });

  it('fills, trims and validates the colour list', () => {
    expect(resolveFishColours(['#123456'], 3)).toEqual([
      '#123456',
      DEFAULT_FISH_COLOURS[1],
      DEFAULT_FISH_COLOURS[2],
    ]);
    expect(resolveFishColours(['nope', '#abcdef', '#abc'], 2)).toEqual(['#abcdef', DEFAULT_FISH_COLOURS[1]]);
    expect(resolveFishColours(undefined, 99)).toHaveLength(MAX_FISH);
    expect(resolveFishColours(undefined, 0)).toHaveLength(1);
  });

  it('sanitises imported fish settings and keeps the colour count in sync', () => {
    const data = normalisePortalData({
      version: 2,
      widgets: [{ id: 'fish-1', type: 'fish', collapsed: false }],
      widgetSettings: {
        'fish-1': {
          fishCount: 99,
          colours: ['#ff0000', 'not-a-colour', '#00FF00'],
          speed: 'warp',
          water: 'lava',
          bubbles: 'yes',
          plants: false,
          tall: true,
        },
      },
    });

    const settings = data.widgetSettings['fish-1'] as FishSettings;
    expect(settings.fishCount).toBe(MAX_FISH);
    expect(settings.colours).toHaveLength(MAX_FISH);
    expect(settings.colours.slice(0, 2)).toEqual(['#ff0000', '#00FF00']);
    expect(settings.speed).toBe('normal');
    expect(settings.water).toBe('reef');
    expect(settings.bubbles).toBe(true);
    expect(settings.plants).toBe(false);
    expect(settings.tall).toBe(true);
  });

  it('clamps a tiny tank to a single fish', () => {
    const data = normalisePortalData({
      version: 2,
      widgets: [{ id: 'fish-1', type: 'fish', collapsed: false }],
      widgetSettings: {
        'fish-1': {
          fishCount: 0,
          colours: [],
          speed: 'calm',
          water: 'night',
          bubbles: false,
          plants: true,
          tall: false,
        },
      },
    });

    const settings = data.widgetSettings['fish-1'] as FishSettings;
    expect(settings.fishCount).toBe(1);
    expect(settings.colours).toHaveLength(1);
    expect(settings.speed).toBe('calm');
    expect(settings.water).toBe('night');
  });
});
