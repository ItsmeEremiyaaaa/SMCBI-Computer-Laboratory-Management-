import { nameKey } from './People';

describe('nameKey', () => {
  it('matches schedule names to account names', () => {
    expect(nameKey('S. April Mariae Libradilla, RVM')).toBe(nameKey('April Libradilla'));
    expect(nameKey('Jhon Bryan J. Cantil, MIT')).toBe(nameKey('Jhon Cantil'));
    expect(nameKey('Rhyven Jay G. Caballero')).toBe(nameKey('Rhyven Jay Caballero'));
    expect(nameKey('Kaye C. Bautista')).not.toBe(nameKey('Kaye Santos'));
  });
});
