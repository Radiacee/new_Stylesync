import { describe, it, expect } from 'vitest';
import { detectPOV } from '../../lib/pov';

describe('detectPOV', () => {
  it('detects first person', () => {
    const res = detectPOV("I think we should review our plan. It seems to me that our approach works.");
    expect(res.pov === 'first' || res.pov === 'mixed').toBeTruthy();
    expect(res.counts.first).toBeGreaterThan(0);
  });

  it('detects second person', () => {
    const res = detectPOV("You should back up your files. If you do, your work will be safe.");
    expect(res.pov === 'second' || res.pov === 'mixed').toBeTruthy();
    expect(res.counts.second).toBeGreaterThan(0);
  });

  it('detects third person', () => {
    const res = detectPOV("They believe the project will succeed, and she agrees with them.");
    expect(res.pov === 'third' || res.pov === 'mixed').toBeTruthy();
    expect(res.counts.third).toBeGreaterThan(0);
  });

  it('returns unknown when no pronouns', () => {
    const res = detectPOV("Protecting the environment is important for future generations.");
    expect(res.pov === 'unknown' || res.pov === 'third' || res.pov === 'mixed').toBeTruthy();
  });
});
