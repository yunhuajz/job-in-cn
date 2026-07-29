"use client";

type RecordsCountProps = {
  count: number;
  total: number;
  label?: string;
};

export function RecordsCount({
  count,
  total,
  label = "records",
}: RecordsCountProps) {
  return (
    <div className="text-xs text-muted-foreground">
      显示 <strong>1–{count}</strong> / 共 <strong>{total}</strong> {label}
    </div>
  );
}
