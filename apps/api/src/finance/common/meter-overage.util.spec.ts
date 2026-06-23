import { calculateMeterOverage } from './meter-overage.util';

describe('calculateMeterOverage', () => {
  it('초과분이 없으면 charge 0을 반환한다', () => {
    const result = calculateMeterOverage({
      totalBlackUsage: 500,
      totalColorUsage: null,
      freeBlackCount: 1000,
      blackUnitPrice: 10,
      freeColorCount: null,
      colorUnitPrice: null,
    });

    expect(result.blackOverage).toBe(0);
    expect(result.blackCharge).toBe(0);
    expect(result.colorOverage).toBe(0);
    expect(result.colorCharge).toBe(0);
    expect(result.totalCharge).toBe(0);
  });

  it('흑백 초과분만 있을 때 정확히 계산한다', () => {
    const result = calculateMeterOverage({
      totalBlackUsage: 1500,
      totalColorUsage: null,
      freeBlackCount: 1000,
      blackUnitPrice: 10,
      freeColorCount: null,
      colorUnitPrice: null,
    });

    expect(result.blackOverage).toBe(500);
    expect(result.blackCharge).toBe(5000);
    expect(result.totalCharge).toBe(5000);
    expect(result.description).toContain('흑백 초과 500매');
  });

  it('흑백 + 컬러 모두 초과 시 합산한다', () => {
    const result = calculateMeterOverage({
      totalBlackUsage: 1200,
      totalColorUsage: 300,
      freeBlackCount: 1000,
      blackUnitPrice: 10,
      freeColorCount: 100,
      colorUnitPrice: 50,
    });

    expect(result.blackOverage).toBe(200);
    expect(result.blackCharge).toBe(2000);
    expect(result.colorOverage).toBe(200);
    expect(result.colorCharge).toBe(10000);
    expect(result.totalCharge).toBe(12000);
  });

  it('freeBlackCount가 null이면 0으로 처리한다', () => {
    const result = calculateMeterOverage({
      totalBlackUsage: 100,
      totalColorUsage: null,
      freeBlackCount: null,
      blackUnitPrice: 10,
      freeColorCount: null,
      colorUnitPrice: null,
    });

    expect(result.blackOverage).toBe(100);
    expect(result.blackCharge).toBe(1000);
  });

  it('blackUnitPrice가 null이면 charge 0을 반환한다', () => {
    const result = calculateMeterOverage({
      totalBlackUsage: 1500,
      totalColorUsage: null,
      freeBlackCount: 1000,
      blackUnitPrice: null,
      freeColorCount: null,
      colorUnitPrice: null,
    });

    expect(result.blackOverage).toBe(500);
    expect(result.blackCharge).toBe(0);
    expect(result.totalCharge).toBe(0);
  });

  it('totalColorUsage가 null이면 컬러 초과분을 계산하지 않는다', () => {
    const result = calculateMeterOverage({
      totalBlackUsage: 0,
      totalColorUsage: null,
      freeBlackCount: 100,
      blackUnitPrice: 10,
      freeColorCount: 50,
      colorUnitPrice: 50,
    });

    expect(result.colorOverage).toBe(0);
    expect(result.colorCharge).toBe(0);
  });
});
