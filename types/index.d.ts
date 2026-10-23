export type NestView = { frame: number }

declare module 'claude-code' {
  interface PluginState {
    'ant-nest': { view: NestView; tab: string }
  }
}
