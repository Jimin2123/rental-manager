export interface MeterOverageInput {
  totalBlackUsage: number;
  totalColorUsage: number | null;
  freeBlackCount: number | null;
  blackUnitPrice: number | null;
  freeColorCount: number | null;
  colorUnitPrice: number | null;
}

export interface MeterOverageResult {
  blackOverage: number;
  blackCharge: number;
  colorOverage: number;
  colorCharge: number;
  totalCharge: number;
  description: string;
}

export function calculateMeterOverage(input: MeterOverageInput): MeterOverageResult {
  const freeBlack = input.freeBlackCount ?? 0;
  const blackPrice = input.blackUnitPrice ?? 0;
  const freeColor = input.freeColorCount ?? 0;
  const colorPrice = input.colorUnitPrice ?? 0;

  const blackOverage = Math.max(0, input.totalBlackUsage - freeBlack);
  const blackCharge = blackOverage * blackPrice;

  const colorOverage = input.totalColorUsage != null ? Math.max(0, input.totalColorUsage - freeColor) : 0;
  const colorCharge = colorOverage * colorPrice;

  const totalCharge = blackCharge + colorCharge;

  const parts: string[] = [];
  if (blackOverage > 0) parts.push(`흑백 초과 ${blackOverage}매 × ${blackPrice.toLocaleString()}원`);
  if (colorOverage > 0) parts.push(`컬러 초과 ${colorOverage}매 × ${colorPrice.toLocaleString()}원`);
  const description = parts.length > 0 ? parts.join(', ') : '카운터 초과 없음';

  return { blackOverage, blackCharge, colorOverage, colorCharge, totalCharge, description };
}
