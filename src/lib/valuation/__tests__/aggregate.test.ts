import { describe, expect, it } from 'vitest';
import { basketYears, calendarize, type BasketHolding } from '../aggregate';

const holding = (symbol: string, weight: number, price: number, eps: Record<string, number>): BasketHolding => ({
  symbol,
  weight,
  price,
  eps: new Map(Object.entries(eps)),
});

describe('basketYears', () => {
  it('is total value over total earnings, not a mean of P/Es', () => {
    // 10x and 90x at equal weight: the mean would be 50x, the basket pays 18x.
    const [y] = basketYears([holding('A', 1, 100, { '2027': 10 }), holding('B', 1, 90, { '2027': 1 })], ['2027']);
    expect(y.pe).toBeCloseTo(2 / (0.1 + 1 / 90), 6);
    expect(y.pe).toBeCloseTo(18, 0);
    expect(y.count).toBe(2);
    expect(y.coverage).toBe(1);
  });

  it('weights by position', () => {
    const [y] = basketYears([holding('A', 3, 100, { '2027': 10 }), holding('B', 1, 100, { '2027': 2 })], ['2027']);
    expect(y.pe).toBeCloseTo(4 / (0.3 + 0.02), 6);
  });

  it('counts losses aside and leaves them out of the P/E', () => {
    const [y] = basketYears([holding('A', 1, 100, { '2027': 5 }), holding('B', 1, 100, { '2027': -3 })], ['2027']);
    expect(y.pe).toBe(20);
    expect(y.losses).toBe(1);
    expect(y.coverage).toBe(0.5);
  });

  it('grows earnings on holdings covered in both years', () => {
    const years = basketYears(
      [holding('A', 1, 100, { '2027': 5, '2028': 6 }), holding('B', 1, 100, { '2028': 50 })],
      ['2027', '2028'],
    );
    expect(years[0].growth).toBeNull();
    expect(years[1].growth).toBeCloseTo(0.2, 6);
  });

  it('drops a P/E that can only be a currency mix-up', () => {
    const [y] = basketYears([holding('A', 1, 100, { '2027': 5 }), holding('TWD', 1, 100, { '2027': 400 })], ['2027']);
    expect(y.pe).toBe(20);
    expect(y.count).toBe(1);
  });
});

describe('calendarize', () => {
  it('leaves a December year as it is', () => {
    const m = calendarize([{ date: '2027-12-31', eps: 5 }], ['2027']);
    expect(m.get('2027')).toBeCloseTo(5, 6);
  });

  it('blends a September year into the calendar years it spans', () => {
    const m = calendarize(
      [
        { date: '2027-09-30', eps: 8 },
        { date: '2028-09-30', eps: 12 },
      ],
      ['2027', '2028'],
    );
    // CY2027 is three quarters of FY2027 and one of FY2028.
    expect(m.get('2027')).toBeCloseTo(9, 1);
    // CY2028 would need FY2029 for its last quarter.
    expect(m.has('2028')).toBe(false);
  });
});
