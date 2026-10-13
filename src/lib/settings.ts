export const SETTING_KEYS = [
  "workspace.name",
  "workspace.defaultColonyId",
  "workspace.sidebarCollapsed",
  "appearance.density",
  "appearance.radius",
  "appearance.accent",
  "appearance.defaultThemeId",
  "refresh.preset",
  "automations.requireApproval",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  "workspace.name": "My Workspace",
  "workspace.defaultColonyId": "",
  "workspace.sidebarCollapsed": "false",
  "appearance.density": "comfortable",
  "appearance.radius": "rounded",
  "appearance.accent": "none",
  "appearance.defaultThemeId": "void",
  "refresh.preset": "normal",
  "automations.requireApproval": "false",
};