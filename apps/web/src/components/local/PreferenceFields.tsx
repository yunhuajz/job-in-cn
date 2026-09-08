"use client";
import type { JobPreferences } from "@/lib/local/preferences";

export const fieldClass = "mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-normal shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

export default function PreferenceFields({ value, onChange }: {
  value: JobPreferences;
  onChange: (value: JobPreferences) => void;
}) {
  const set = (patch: Partial<JobPreferences>) => onChange({ ...value, ...patch });
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-sm font-medium">具体地点
      <input className={fieldClass} value={value.location} placeholder="区、街道或地址关键词，不限则留空" onChange={(e) => set({ location: e.target.value })} />
    </label>
    <label className="text-sm font-medium">薪资匹配方式
      <select className={fieldClass} value={value.salaryMode} onChange={(e) => set({ salaryMode: e.target.value as JobPreferences['salaryMode'] })}>
        <option value="minimum">最高月薪达到最低要求</option><option value="overlap">月薪范围有重叠</option>
      </select>
    </label>
    <label className="text-sm font-medium">最低月薪（元）
      <input className={fieldClass} type="number" min="0" max="1000000" value={value.salaryMin || ''} placeholder="不限" onChange={(e) => set({ salaryMin: Number(e.target.value) })} />
    </label>
    {value.salaryMode === 'overlap' && <label className="text-sm font-medium">最高月薪（元）
      <input className={fieldClass} type="number" min="0" max="1000000" value={value.salaryMax || ''} placeholder="不限" onChange={(e) => set({ salaryMax: Number(e.target.value) })} />
    </label>}
    <label className="text-sm font-medium">双休要求
      <select className={fieldClass} value={value.weekend} onChange={(e) => set({ weekend: e.target.value as JobPreferences['weekend'] })}>
        <option value="any">不限</option><option value="yes">双休</option><option value="no">非双休</option>
      </select>
    </label>
    <label className="flex items-center gap-2 text-sm sm:pt-6">
      <input type="checkbox" checked={value.keepUnknown} onChange={(e) => set({ keepUnknown: e.target.checked })} />
      保留条件未知的岗位
    </label>
  </div>;
}
