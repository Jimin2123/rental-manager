import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fetchCustomer, customerKeys } from '../-api';
import { fetchPartner, partnerKeys } from '../../business-partners/-api';
import { ROLE_LABEL } from '../../business-partners/-types';

type SelectedItem = { type: 'customer'; id: string } | { type: 'partner'; id: string };

type Props = {
  selected: SelectedItem;
};


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[#8a919e] dark:text-muted-foreground flex-none">{label}</span>
      <span className="text-[#2a2f3a] dark:text-foreground font-semibold text-right break-all">{value}</span>
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto border border-[#dce0e8] dark:border-border bg-white dark:bg-card text-[#5b6472] dark:text-muted-foreground text-[12px] font-semibold px-3 py-1.5 rounded-[7px] cursor-pointer hover:bg-[#f6f7f9] dark:hover:bg-muted/50 flex-none"
    >
      상세보기
    </button>
  );
}

function CustomerPanel({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => fetchCustomer(id),
  });

  if (isLoading) {
    return <div className="py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">불러오는 중...</div>;
  }
  if (!data) return null;

  const isIndividual = data.type === 'INDIVIDUAL';
  const name = data.individualProfile?.name ?? data.businessPartner?.businessProfile.name ?? '-';

  return (
    <>
      <div className="flex items-center gap-[11px] pb-[14px] border-b border-[#eef0f4] dark:border-border">
        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] font-bold text-[#1c2230] dark:text-foreground truncate">{name}</div>
          <div className="text-[12px] text-[#98a0ad] dark:text-muted-foreground mt-0.5">
            {isIndividual ? '개인' : `사업자 ${data.businessPartner?.businessProfile.businessRegistrationNo ?? ''}`}
          </div>
        </div>
        <EditButton onClick={() => void navigate({ to: '/customers/$id', params: { id } })} />
      </div>

      <div className="flex flex-col gap-[9px] pt-[14px] text-[13px]">
        {isIndividual ? (
          <>
            {data.individualProfile?.phone && <Row label="연락처" value={data.individualProfile.phone} />}
            {data.individualProfile?.email && <Row label="이메일" value={data.individualProfile.email} />}
            {data.individualProfile?.address && <Row label="주소" value={data.individualProfile.address.address} />}
          </>
        ) : (
          <>
            {data.businessPartner?.roles && data.businessPartner.roles.length > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-[#8a919e] dark:text-muted-foreground flex-none">역할</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {data.businessPartner.roles.map((r) => (
                    <span
                      key={r.id}
                      className="text-[11.5px] font-semibold text-[#5b6472] dark:text-muted-foreground bg-[#eef0f4] dark:bg-muted/50 px-2 py-0.5 rounded-md"
                    >
                      {ROLE_LABEL[r.type]}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.businessPartner?.businessProfile.representativeName && (
              <Row label="대표자" value={data.businessPartner.businessProfile.representativeName} />
            )}
            {data.businessPartner?.businessProfile.phone && (
              <Row label="연락처" value={data.businessPartner.businessProfile.phone} />
            )}
            {data.businessPartner?.businessProfile.email && (
              <Row label="이메일" value={data.businessPartner.businessProfile.email} />
            )}
            {data.businessPartner?.businessProfile.address && (
              <Row label="주소" value={data.businessPartner.businessProfile.address.address} />
            )}
          </>
        )}
      </div>
    </>
  );
}

function PartnerPanel({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: partnerKeys.detail(id),
    queryFn: () => fetchPartner(id),
  });

  if (isLoading) {
    return <div className="py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">불러오는 중...</div>;
  }
  if (!data) return null;

  const primaryContact = data.contacts.find((c) => c.isPrimary) ?? data.contacts[0];

  return (
    <>
      <div className="flex items-center gap-[11px] pb-[14px] border-b border-[#eef0f4] dark:border-border">
        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] font-bold text-[#1c2230] dark:text-foreground truncate">{data.businessProfile.name}</div>
          <div className="text-[12px] text-[#98a0ad] dark:text-muted-foreground mt-0.5">사업자 {data.businessProfile.businessRegistrationNo}</div>
        </div>
        <EditButton onClick={() => void navigate({ to: '/business-partners/$id', params: { id } })} />
      </div>

      <div className="flex flex-col gap-[9px] pt-[14px] text-[13px]">
        {data.businessProfile.representativeName && (
          <Row label="대표자" value={data.businessProfile.representativeName} />
        )}
        <div className="flex justify-between gap-2">
          <span className="text-[#8a919e] dark:text-muted-foreground flex-none">역할</span>
          <div className="flex gap-1 flex-wrap justify-end">
            {data.roles.map((r) => (
              <span
                key={r.type}
                className="text-[11.5px] font-semibold text-[#5b6472] dark:text-muted-foreground bg-[#eef0f4] dark:bg-muted/50 px-2 py-0.5 rounded-md"
              >
                {ROLE_LABEL[r.type]}
              </span>
            ))}
          </div>
        </div>
        {primaryContact && (
          <Row
            label="대표 담당자"
            value={`${primaryContact.name}${primaryContact.phone ? ` · ${primaryContact.phone}` : ''}`}
          />
        )}
        {data.businessProfile.address && <Row label="주소" value={data.businessProfile.address.address} />}
      </div>
    </>
  );
}

export function DetailPanel({ selected }: Props) {
  return (
    <div className="w-96 flex-none bg-white dark:bg-card border border-[#e5e8ee] dark:border-border rounded-xl p-5">
      {selected.type === 'customer' ? <CustomerPanel id={selected.id} /> : <PartnerPanel id={selected.id} />}
    </div>
  );
}
