import type { TourPreset } from '@velo/content';

/** The rest days a tour preset suggests (after these 1-based stage numbers), halfway by default. */
export function presetRestDays(preset: TourPreset): number[] {
  return [preset.restAfter ?? Math.ceil(preset.stages.length / 2)].flat();
}

/** Checkbox label naming the rest days, e.g. "Rest days after stages 9 and 15". */
export function restDaysLabel(preset: TourPreset): string {
  const rests = presetRestDays(preset);
  return rests.length > 1
    ? `Rest days after stages ${rests.slice(0, -1).join(', ')} and ${rests.at(-1)}`
    : `Rest day after stage ${rests[0]}`;
}
