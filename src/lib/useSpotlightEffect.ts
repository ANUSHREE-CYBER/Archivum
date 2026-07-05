import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

interface SpotlightConfig {
  spotlightSize?: number
  spotlightIntensity?: number
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
    spotlightSize = 200,
    spotlightIntensity = 0.8,
    fadeSpeed = 0.1,
    glowColor = '212, 175, 106',
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

      gradient.addColorStop(0, `rgba(${glowColor}, ${spotlightIntensity})`)
      gradient.addColorStop(0.5, `rgba(${glowColor}, ${spotlightIntensity * 0.5})`)
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
        currentSpotlightSize * 1.2
      )
      glowGradient.addColorStop(0, `rgba(${glowColor}, 0.2)`)
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(spotlightPos.current.x, spotlightPos.current.y, currentSpotlightSize * 1.2, 0, Math.PI * 2)
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
  }, [spotlightSize, spotlightIntensity, fadeSpeed, glowColor, pulseSpeed])

  return canvasRef
}

export default useSpotlightEffect
