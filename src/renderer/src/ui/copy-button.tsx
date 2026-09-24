import { useEffect, useRef, useState } from 'react'

/**
 * Copying is invisible without feedback, which reads as a dead button, so the
 * label confirms it for a moment.
 */
type CopyButtonProps = {
  text: string
  label: string
}

export function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [])

  function copy(): void {
    window.ray.copy(text)
    setCopied(true)

    if (timer.current) {
      clearTimeout(timer.current)
    }

    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button className={copied ? 'button button--confirmed' : 'button'} onClick={copy} type="button">
      {copied ? 'Copied' : label}
    </button>
  )
}
