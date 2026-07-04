import { useState } from 'react'

interface MeteorStyle {
  top: string
  left: string
  distance?: string
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
  // bottom-left of the page empty. Three spawn groups fill the page:
  // top edge (40%), right edge (35%), and mid-page spawners (25%) that start
  // already in the bottom half and take a shorter trip so they don't overshoot.
  const [meteors] = useState<MeteorStyle[]>(() =>
    Array.from({ length: number }, () => {
      const r = Math.random()
      if (r < 0.4) {
        return {
          top: '-5%',
          left: `${Math.random() * 100}%`,
          animationDelay: `${(Math.random() * 1 + 0.2).toFixed(2)}s`,
          animationDuration: `${(Math.random() * 13 + 2).toFixed(2)}s`,
        }
      }
      if (r < 0.75) {
        return {
          top: `${Math.random() * 90}%`,
          left: '105%',
          animationDelay: `${(Math.random() * 1 + 0.2).toFixed(2)}s`,
          animationDuration: `${(Math.random() * 13 + 2).toFixed(2)}s`,
        }
      }
      return {
        top: `${Math.random() * 40 + 30}%`,
        left: `${Math.random() * 100}%`,
        distance: '-800px',
        animationDelay: `${(Math.random() * 1 + 0.2).toFixed(2)}s`,
        animationDuration: `${(Math.random() * 6 + 2).toFixed(2)}s`,
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
            ...(meteor.distance ? { '--meteor-distance': meteor.distance } : {}),
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
