import type { MasAPI } from '../preload/index'

declare global {
  interface Window {
    mas: MasAPI
  }
}
