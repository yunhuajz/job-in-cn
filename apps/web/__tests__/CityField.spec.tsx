import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CityField from "@/components/local/CityField";
import { isCitySupported, searchSupportedCities } from "@/lib/local/city-options";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CityField 组件交互与内置代码判定", () => {
  it("isCitySupported 能准确识别全国重点城市与纯数字代码", () => {
    expect(isCitySupported("北京")).toBe(true);
    expect(isCitySupported("潍坊")).toBe(true);
    expect(isCitySupported("潍坊市")).toBe(true);
    expect(isCitySupported("济南")).toBe(true);
    expect(isCitySupported("全国")).toBe(true);
    expect(isCitySupported("远程")).toBe(true);
    expect(isCitySupported("101120600")).toBe(true);
    expect(isCitySupported("火星小镇")).toBe(false);
  });

  it("searchSupportedCities 支持按拼音或汉字前缀模糊搜索", () => {
    const results = searchSupportedCities("烟");
    expect(results).toContain("烟台");
  });

  it("点击常用城市按钮可直接添加，已选城市点击可取消", () => {
    const onChange = vi.fn();
    const onNotice = vi.fn();

    const { rerender } = render(
      <CityField value="北京" onChange={onChange} onNotice={onNotice} />
    );

    // 点击常用推荐里的“潍坊”
    const weifangBtn = screen.getAllByRole("button", { name: /潍坊/ })[0];
    fireEvent.click(weifangBtn);

    expect(onChange).toHaveBeenCalledWith("北京\n潍坊");
    expect(onNotice).toHaveBeenCalledWith("配置已修改");

    // 重新渲染为已含潍坊的状态
    rerender(
      <CityField value={"北京\n潍坊"} onChange={onChange} onNotice={onNotice} />
    );

    // 再次点击“潍坊”应取消选中
    fireEvent.click(screen.getAllByRole("button", { name: /潍坊/ })[0]);
    expect(onChange).toHaveBeenCalledWith("北京");
  });

  it("输入未内置代码的城市时，给出明确提示避免用户误解", () => {
    render(<CityField value={"北京\n未知生僻镇"} onChange={vi.fn()} />);

    expect(
      screen.getByText(/城市【未知生僻镇】未在平台内置专属数字代码/)
    ).toBeInTheDocument();
  });

  it("支持展开按省份浏览城市并选择", () => {
    const onChange = vi.fn();
    render(<CityField value="" onChange={onChange} />);

    // 点击展开省份浏览
    const toggleBtn = screen.getByText(/按省份浏览全部已支持城市/);
    fireEvent.click(toggleBtn);

    // 点击“山东省”标签
    const shandongTab = screen.getByRole("button", { name: "山东省" });
    fireEvent.click(shandongTab);

    // 点击山东省独有的“淄博”
    const ziboBtn = screen.getByRole("button", { name: "淄博" });
    fireEvent.click(ziboBtn);

    expect(onChange).toHaveBeenCalledWith("淄博");
  });
});
