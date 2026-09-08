import LocalAiSettings from "@/components/local/LocalAiSettings";
import SettingsClient from "@/components/settings/SettingsClient";

export default function SettingsPage() {
  return process.env.JBCN_LOCAL === "1" ? <LocalAiSettings /> : <SettingsClient />;
}
