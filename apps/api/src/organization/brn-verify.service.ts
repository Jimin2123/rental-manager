import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface NtsStatusItem {
  b_no: string;
  b_stt: string; // 계속사업자 | 휴업자 | 폐업자
  b_stt_cd: string; // 01: 계속, 02: 휴업, 03: 폐업
  tax_type: string;
  end_dt: string;
}

interface NtsStatusResponse {
  status_code: string;
  match_cnt: number;
  request_cnt: number;
  data: NtsStatusItem[];
}

export interface BrnVerifyResult {
  valid: boolean;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  '01': '계속사업자',
  '02': '휴업자',
  '03': '폐업자',
};

@Injectable()
export class BrnVerifyService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('NTS_API_KEY') ?? '';
  }

  async verify(businessRegistrationNo: string): Promise<BrnVerifyResult> {
    if (!this.apiKey) throw new InternalServerErrorException('사업자등록번호 조회 서비스가 설정되지 않았습니다.');

    const url = `${this.apiUrl}?serviceKey=${encodeURIComponent(this.apiKey)}&returnType=JSON`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: [businessRegistrationNo] }),
    });

    if (!res.ok) throw new InternalServerErrorException('사업자등록번호 조회 중 오류가 발생했습니다.');

    const json = (await res.json()) as NtsStatusResponse;
    const item = json.data?.[0];

    if (!item) return { valid: false, status: '미등록' };

    const label = STATUS_LABEL[item.b_stt_cd] ?? item.b_stt;
    return { valid: item.b_stt_cd === '01', status: label };
  }
}
