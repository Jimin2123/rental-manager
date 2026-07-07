export function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="text-[11.5px] font-bold text-[#0d8a4f] dark:text-emerald-400 bg-[#e7f6ee] dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
        활성
      </span>
    );
  }
  return (
    <span className="text-[11.5px] font-bold text-[#c2372f] dark:text-red-400 bg-[#fdeceb] dark:bg-red-900/30 px-2 py-0.5 rounded-md">
      거래정지
    </span>
  );
}
