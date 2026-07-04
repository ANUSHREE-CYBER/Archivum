import { useState } from 'react'

interface MeteorStyle {
  top: string
  left: string
  animationDelay: string
  animationDuration: string
}

interface Props {
  number?: number
  angle?: number
}

export default function Meteors({ number = 20, angle = 215 }: Props) {
  // Lazy initializer instead of useEffect: these random values only need to be
  // picked once per mount, and there's no SSR here to cause a hydration mismatch.
  //
  // Meteors travel down-left (angle 215), so top-edge-only spawning leaves the
  // bottom-left of the page empty. ~40% spawn from the right edge instead,
  // streaking down-left to fill that void.
  const [meteors] = useState<MeteorStyle[]>(() =>
    Array.from({ length: number }, () => {
      const fromRightEdge = Math.random() < 0.4
      return {
        top: fromRightEdge ? `${Math.random() * 60}%` : '-5%',
        left: fromRightEdge ? '105%' : `${Math.random() * 100}%`,
        animationDelay: `${(Math.random() * 1 + 0.2).toFixed(2)}s`,
        animationDuration: `${(Math.random() * 13 + 2).toFixed(2)}s`,
      }
    })
  )

  return (
    <>
      {meteors.map((meteor, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-meteor pointer-events-none"
          style={{
            top: meteor.top,
            left: meteor.left,
            width: 3,
            height: 3,
            zIndex: -1,
            background: '#E8C86A',
            boxShadow: '0 0 6px 2px rgba(232, 200, 106, 0.5)',
            animationDelay: meteor.animationDelay,
            animationDuration: meteor.animationDuration,
            '--angle': `${angle}deg`,
          }}
        >
          <span
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              right: 1,
              width: 80,
              height: 2,
              background: 'linear-gradient(90deg, #E8C86A, transparent)',
            }}
          />
        </span>
      ))}
    </>
  )
}
