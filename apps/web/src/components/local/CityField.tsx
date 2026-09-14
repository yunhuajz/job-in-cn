"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import {
  HOT_CITIES,
  PROVINCE_CITY_GROUPS,
  isCitySupported,
} from "@/lib/local/city-options";
import { fieldClass } from "./PreferenceFields";

interface CityFieldProps {
  value: string;
  onChange: (value: string) => void;
  onNotice?: (text: string) => void;
  disabled?: boolean;
}

const splitTerms = (val: string) =>
  val
    .split(/[\n\r,，]+|\\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function CityField({
  value,
  onChange,
  onNotice,
  disabled = false,
}: CityFieldProps) {
  const [showProvinces, setShowProvinces] = useState(false);
  const [activeProvince, setActiveProvince] = useState("山东省");

  // 解析当前已选城市列表（保持用户顺序并去重）
  const selectedCities = useMemo(() => {
    return [...new Set(splitTerms(value))];
  }, [value]);

  // 检测是否有未内置代码的自定义城市
  const unsupportedCities = useMemo(() => {
    return selectedCities.filter((c) => !isCitySupported(c));
  }, [selectedCities]);

  function commitCities(nextList: string[]) {
    const unique = [...new Set(nextList.map((s) => s.trim()).filter(Boolean))];
    onChange(unique.join("\n"));
    onNotice?.("配置已修改");
  }

  function toggleCity(city: string) {
    if (selectedCities.includes(city)) {
      commitCities(selectedCities.filter((c) => c !== city));
    } else {
      commitCities([...selectedCities, city]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="crawler-cities-textarea" className="text-sm font-medium">
          搜索城市
        </label>
        <span className="text-xs text-muted-foreground">
          可直接输入，也可点击下方城市快速选择
        </span>
      </div>

      {/* 原生自由编辑文本框：支持多行/逗号自由输入与批量粘贴 */}
      <textarea
        id="crawler-cities-textarea"
        aria-label="搜索城市"
        className={fieldClass}
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          onNotice?.("配置已修改");
        }}
        placeholder="每行一个城市，如天津、青岛；支持全国、远程；也可从下方直接点击添加"
      />

      {/* 城市支持状态透明提示（明确告知哪些内置了代码，哪些没有） */}
      {unsupportedCities.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">提示：</span>
          城市【{unsupportedCities.join("、")}】未在平台内置专属数字代码，采集时将通过全国搜索后按地点文本筛选。
        </div>
      )}

      {/* 常用热门城市快捷选择按钮组 */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>快捷选择（点击添加/取消）：</span>
          {selectedCities.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => commitCities([])}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              清空所选
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HOT_CITIES.map((c) => {
            const isSelected = selectedCities.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => toggleCity(c)}
                className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-medium shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {isSelected && <Check className="mr-1 inline h-3 w-3" />}
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* 按省份分类展开选择器 */}
      <div className="border-t border-dashed pt-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowProvinces((prev) => !prev)}
          className="flex w-full items-center justify-between py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>按省份浏览全部已支持城市（山东、江苏、浙江、湖北、广东等）</span>
          {showProvinces ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {showProvinces && (
          <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-2.5">
            {/* 省份切换标签 */}
            <div className="flex flex-wrap gap-1 border-b pb-2">
              {PROVINCE_CITY_GROUPS.map((g) => (
                <button
                  key={g.province}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveProvince(g.province)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    activeProvince === g.province
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {g.province}
                </button>
              ))}
            </div>

            {/* 当前省份下的城市列表 */}
            <div className="flex flex-wrap gap-1.5 pt-1 max-h-40 overflow-y-auto">
              {PROVINCE_CITY_GROUPS.find(
                (g) => g.province === activeProvince
              )?.cities.map((city) => {
                const isSelected = selectedCities.includes(city);
                return (
                  <button
                    key={city}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleCity(city)}
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-medium shadow-xs"
                        : "bg-background border text-foreground hover:border-primary/50"
                    }`}
                  >
                    {isSelected && <Check className="mr-1 h-3 w-3" />}
                    {city}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
