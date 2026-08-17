import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

interface SpotlightConfig {
  spotlightSize?: number
  spotlightIntensity?: number
  glowIntensity?: number
  fadeSpeed?: number
  glowColor?: string
  pulseSpeed?: number
}

interface Position {
  x: number
  y: number
}

function useSpotlightEffect(config: SpotlightConfig = {}): RefObject<HTMLCanvasElement | null> {
  const {
    // The hole punched in the dark overlay. `spotlightIntensity` is an alpha
    // fed to a destination-out fill, so 1 = the overlay is fully erased at the
    // centre and the poster underneath reads at its true brightness.
    spotlightSize = 260,
    spotlightIntensity = 1,
    // Alpha of the separate rose-gold wash painted on top of the hole — this
    // is the only pass where `glowColor` actually shows, since destination-out
    // uses a fill's alpha and throws its RGB away.
    glowIntensity = 0.28,
    fadeSpeed = 0.1,
    glowColor = '183, 110, 121',
    pulseSpeed = 2000,
  } = config

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spotlightPos = useRef<Position>({ x: 0, y: 0 })
  const targetPos = useRef<Position>({ x: 0, y: 0 })
  const animationFrame = useRef<number | null>(null)
  const [, setIsHovered] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setIsHovered(true)
    }

    const handleMouseLeave = () => {
      setIsHovered(false)
    }

    const render = () => {
      spotlightPos.current.x = lerp(spotlightPos.current.x, targetPos.current.x, fadeSpeed)
      spotlightPos.current.y = lerp(spotlightPos.current.y, targetPos.current.y, fadeSpeed)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Create dark overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Calculate pulse effect
      const pulseScale = 1 + 0.1 * Math.sin((Date.now() / pulseSpeed) * Math.PI * 2)
      const currentSpotlightSize = spotlightSize * pulseScale

      // Create spotlight gradient
      const gradient = ctx.createRadialGradient(
        spotlightPos.current.x,
        spotlightPos.current.y,
        0,
        spotlightPos.current.x,
        spotlightPos.current.y,
        currentSpotlightSize
      )

      // Four stops rather than two: the extra pair holds the core near full
      // strength out to ~a third of the radius (so a poster under the cursor is
      // fully lit, not just its centre pixel) and then eases the tail out. A
      // straight 1 → 0 ramp over this bigger radius reads as a hard-edged disc.
      gradient.addColorStop(0, `rgba(${glowColor}, ${spotlightIntensity})`)
      gradient.addColorStop(0.35, `rgba(${glowColor}, ${spotlightIntensity * 0.92})`)
      gradient.addColorStop(0.65, `rgba(${glowColor}, ${spotlightIntensity * 0.55})`)
      gradient.addColorStop(0.85, `rgba(${glowColor}, ${spotlightIntensity * 0.22})`)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

      // Apply spotlight effect
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(spotlightPos.current.x, spotlightPos.current.y, currentSpotlightSize, 0, Math.PI * 2)
      ctx.fill()

      // Add glow effect
      ctx.globalCompositeOperation = 'source-over'
      const glowGradient = ctx.createRadialGradient(
        spotlightPos.current.x,
        spotlightPos.current.y,
        0,
        spotlightPos.current.x,
        spotlightPos.current.y,
        currentSpotlightSize * 1.35
      )
      glowGradient.addColorStop(0, `rgba(${glowColor}, ${glowIntensity})`)
      glowGradient.addColorStop(0.45, `rgba(${glowColor}, ${glowIntensity * 0.55})`)
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(spotlightPos.current.x, spotlightPos.current.y, currentSpotlightSize * 1.35, 0, Math.PI * 2)
      ctx.fill()

      animationFrame.current = requestAnimationFrame(render)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    render()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      if (animationFrame.current !== null) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [spotlightSize, spotlightIntensity, glowIntensity, fadeSpeed, glowColor, pulseSpeed])

  return canvasRef
}

export default useSpotlightEffect
