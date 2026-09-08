import { AiProvider } from "./ai.model";

export interface AiSettings {
  provider: AiProvider;
  model: string | undefined;
  protocol?: "responses" | "chat" | "anthropic";
  baseURL?: string;
}

export interface AiProfile {
  id: string;
  name: string;
  protocol: "responses" | "chat" | "anthropic";
  baseURL: string;
  model: string;
  isActive: boolean;
}

export interface DisplaySettings {
  theme: "light" | "dark" | "system";
}

export interface UserSettingsData {
  ai: AiSettings;
  aiProfiles?: AiProfile[];
  activeProfileId?: string;
  display: DisplaySettings;
}

export interface UserSettings {
  userId: string;
  settings: UserSettingsData;
}

export const defaultUserSettings: UserSettingsData = {
  ai: {
    provider: AiProvider.OLLAMA,
    model: undefined,
  },
  display: {
    theme: "system",
  },
};
