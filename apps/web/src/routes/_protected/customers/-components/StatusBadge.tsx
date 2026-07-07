export function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return <span className="text-[11.5px] font-bold text-[#0d8a4f] bg-[#e7f6ee] px-2 py-0.5 rounded-md">활성</span>;
  }
  return <span className="text-[11.5px] font-bold text-[#c2372f] bg-[#fdeceb] px-2 py-0.5 rounded-md">거래정지</span>;
}
