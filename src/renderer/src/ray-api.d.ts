import type { RayApi } from '../../preload'

declare global {
  interface Window {
    ray: RayApi
  }
}
