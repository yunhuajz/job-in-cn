"use client";
import { useState } from "react";
import AiSettings from "./AiSettings";
import ApiKeySettings from "./ApiKeySettings";
import DisplaySettings from "./DisplaySettings";
import McpAccessSettings from "./McpAccessSettings";
import SettingsSidebar, { type SettingsSection } from "./SettingsSidebar";

export default function SettingsClient() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("ai-provider");
  return <div className="flex flex-col col-span-3"><h3 className="mb-4 text-2xl font-semibold leading-none tracking-tight">AI 与程序设置</h3><div className="flex gap-6"><SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} /><div className="min-w-0 flex-1">{activeSection === "ai-provider" && <AiSettings />}{activeSection === "api-keys" && <ApiKeySettings />}{activeSection === "appearance" && <DisplaySettings />}{activeSection === "mcp-access" && <McpAccessSettings />}</div></div></div>;
}
