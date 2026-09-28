/// <reference types="jest" />
import { formatMoscowDateTime } from './moscow-time';

describe('formatMoscowDateTime', () => {
  it('переводит UTC ISO в Europe/Moscow без второго смещения', () => {
    expect(formatMoscowDateTime('2026-09-27T20:51:12Z')).toBe('27.09.2026 23:51');
  });

  it('оставляет неразборную строку как есть', () => {
    expect(formatMoscowDateTime('не дата')).toBe('не дата');
  });
});
