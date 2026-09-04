import type { RayOrigin } from '../../shared/ray-event'

export function originLabel(origin: RayOrigin): string {
  if (!origin.file) {
    return ''
  }

  const name = origin.file.split('/').pop() ?? origin.file

  return origin.line_number ? `${name}:${origin.line_number}` : name
}
