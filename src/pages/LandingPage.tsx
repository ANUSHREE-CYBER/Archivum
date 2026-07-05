import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import useSpotlightEffect from '../lib/useSpotlightEffect'
import archivumSvg    from '../assets/ARCHIVUM..svg'
import taglineSvg     from "../assets/One vault for every world you've visited..svg"
import openArchiveSvg from '../assets/Open your Archive.svg'

// Local poster imports
import imgKillBill       from '../assets/Posters/Kill-bill.jpg'
import imgDarkKnight     from '../assets/Posters/dark-knight.jpg'
import imgTopGun         from '../assets/Posters/top-gun.jpg'
import imgVigilante      from '../assets/Posters/vigilante.jpg'
import imgVincenzoLocal  from '../assets/Posters/vincenzo.jpg'
import imgJudgeFromHell  from '../assets/Posters/judge-from-hell.jpg'
import imgTheRookie      from '../assets/Posters/the-rookie.jpg'
import imgFriends        from '../assets/Posters/friends.jpg'
import imgAotManga       from '../assets/Posters/aot-manga.jpg'
import imgDeathNoteManga from '../assets/Posters/death-note-manga.jpg'
import imgDemonSlayer    from '../assets/Posters/demon-slayer.jpg'
import imgSoloLeveling   from '../assets/Posters/solo-leveling.jpg'
import imgSnapped        from '../assets/Posters/snapped.jpg'
import imgHannibal       from '../assets/Posters/hannibal.jpg'
import imgGhostInTheShell from '../assets/Posters/ghost-in-the-shell.jpg'
import imgSalt           from '../assets/Posters/salt.jpg'

interface PosterDef {
  url: string
  width: number
  top?: string
  bottom?: string
  left?: string
  right?: string
  rotate: number
  duration: number
  delay: number
}

const POSTERS: PosterDef[] = [
  { url: 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',                        width: 140, top:  '1.6%', left: '20.5%', rotate:  -8, duration: 6.0, delay: 0.0 },
  { url: imgDarkKnight,                                                                                width: 100, top:  '2.4%', left: '40.2%', rotate:   5, duration: 5.0, delay: 0.7 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg', width: 120, top:  '6.3%', left: '56.8%', rotate: -10, duration: 4.5, delay: 1.4 },
  { url: imgFriends,                                                                                   width:  85, top: '13.8%', left: '48.8%', rotate:   7, duration: 7.0, delay: 2.1 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b673Vt5ZSG3C.jpg', width: 100, top:   '10%', left:   '61%', rotate:  -6, duration: 5.5, delay: 0.3 },
  { url: 'https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',                         width: 120, top: '12.4%', left: '78.9%', rotate:   9, duration: 3.5, delay: 1.8 },
  { url: 'https://image.tmdb.org/t/p/w342/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',                        width: 140, top: '11.8%', left: '90.4%', rotate:  11, duration: 5.5, delay: 1.2 },
  { url: imgVigilante,                                                                                 width: 100, top:  '5.2%', left: '10.9%', rotate:  -6, duration: 6.5, delay: 0.4 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002-7EzO7o21jzeF.jpg',  width:  85, top: '16.7%', left: '32.4%', rotate:   9, duration: 4.5, delay: 1.7 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx31148-D1SdlxvGTSbk.jpg',  width:  85, top:   '53%', left:    '2%', rotate:  -3, duration: 3.5, delay: 0.9 },
  { url: 'https://image.tmdb.org/t/p/w342/dvXJgEDQXhL93TO8IpJMnQEeyJD.jpg',                         width: 100, top:   '36%', left:    '0%', rotate:   6, duration: 7.0, delay: 0.2 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg',  width:  85, top: '40.7%', left: '76.7%', rotate:  -9, duration: 6.0, delay: 1.5 },
  { url: 'https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',                         width:  85, top: '42.4%', left: '85.6%', rotate:   4, duration: 4.0, delay: 2.3 },
  { url: 'https://image.tmdb.org/t/p/w342/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',                         width: 100, top:  '8.5%', left:  '1.6%', rotate:  -4, duration: 5.5, delay: 1.1 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/nx21-tXMN3Y20PIL9.jpg',      width:  85, top: '37.1%', left: '18.4%', rotate:   8, duration: 3.5, delay: 0.6 },
  { url: imgTheRookie,                                                                                  width:  85, top:   '38%', left:  '0.6%', rotate:  -7, duration: 6.0, delay: 1.9 },
  { url: imgVincenzoLocal,                                                                              width: 100, top:   '63%', left: '80.8%', rotate:   5, duration: 4.5, delay: 0.8 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx108556-NHjkz0BNJhLx.jpg', width:  85, top: '87.5%', left: '80.1%', rotate: -11, duration: 7.0, delay: 2.5 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTc93blC.jpg', width:  85, top: '46.2%', left: '94.2%', rotate:   6, duration: 3.5, delay: 0.3 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105778-oMoEr4YVijVp.jpg', width: 100, top:   '21%', left:   '22%', rotate:  -7, duration: 5.0, delay: 1.3 },
  { url: imgAotManga,                                                                                   width:  85, top: '12.8%', left: '69.4%', rotate:  -6, duration: 3.0, delay: 2.0 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-lawCMT9PCVJD.jpg',   width:  85, top:   '68%', left:   '23%', rotate:  -5, duration: 4.0, delay: 0.5 },
  { url: 'https://image.tmdb.org/t/p/w342/vcWCfKkXTFsEVIJnQNSHMGeyuPP.jpg',                         width: 100, top:   '67%', left:   '65%', rotate:   9, duration: 6.5, delay: 1.6 },
  { url: imgDemonSlayer,                                                                                width: 140, top: '65.3%', left:  '1.6%', rotate:  -9, duration: 6.0, delay: 0.4 },
  { url: imgJudgeFromHell,                                                                              width: 120, top:   '36%', left:    '9%', rotate:   5, duration: 4.5, delay: 1.6 },
  { url: imgDeathNoteManga,                                                                             width: 100, top: '69.8%', left: '49.8%', rotate:  -3, duration: 6.5, delay: 0.3 },
  { url: imgSoloLeveling,                                                                               width:  85, top: '63.5%', left: '59.7%', rotate:   6, duration: 4.0, delay: 2.3 },
  { url: 'https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911BTUgMe1cBK3F.jpg',                         width: 100, top:   '78%', left:   '57%', rotate:  -7, duration: 7.0, delay: 0.2 },
  { url: imgTopGun,                                                                                    width: 120, top: '62.7%', left:   '70%', rotate:   9, duration: 3.0, delay: 0.6 },
  { url: imgKillBill,                                                                                   width: 140, top: '67.9%', left: '90.1%', rotate:   8, duration: 6.5, delay: 1.1 },
  { url: imgSnapped,                                                                                    width: 100, top:   '60%', left:   '18%', rotate:  -6, duration: 5.2, delay: 0.3 },
  { url: imgHannibal,                                                                                   width: 120, top:   '72%', left:   '30%', rotate:   7, duration: 4.8, delay: 1.1 },
  { url: imgGhostInTheShell,                                                                            width:  85, top:   '80%', left:   '15%', rotate:  -4, duration: 6.1, delay: 0.7 },
  { url: imgSalt,                                                                                       width: 100, top:   '75%', left:   '42%', rotate:   5, duration: 5.5, delay: 1.8 },
]

const INPUT_STYLE: React.CSSProperties = {
  background: '#080808',
  border: '1px solid #2a2a2a',
  color: '#F2EFE9',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError]     = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const spotlightCanvasRef = useSpotlightEffect()

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError(error.message)
    setLoginLoading(false)
  }

  return (
    <>
      <style>{`
        @keyframes posterFloat {
          from { transform: translateY(0px);  }
          to   { transform: translateY(-8px); }
        }
        .lp-poster {
          display: block;
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
          border-radius: 8px;
        }
      `}</style>

      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#080808', overflow: 'hidden', cursor: 'none' }}>

        {/* ── Navbar ── */}
        <nav style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 28px',
          background: 'rgba(8,8,8,0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          <img src={archivumSvg} alt="ARCHIVUM." style={{ width: 130, display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            {(['Features', 'About'] as const).map(label => (
              <button key={label} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: "system-ui, 'Segoe UI', sans-serif",
                fontSize: 13, fontWeight: 400, letterSpacing: 3,
                textTransform: 'uppercase', color: '#6B6660',
                transition: 'color 0.2s ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#F2EFE9' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B6660' }}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Poster collage ── */}
        {POSTERS.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: p.width,
              top: p.top,
              bottom: p.bottom,
              left: p.left,
              right: p.right,
              transform: `rotate(${p.rotate}deg)`,
              zIndex: 1,
            }}
          >
            <img
              src={p.url}
              alt=""
              className="lp-poster"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              style={{ animation: `posterFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate` }}
            />
          </div>
        ))}

        {/* ── Spotlight cursor canvas ── */}
        <canvas
          ref={spotlightCanvasRef}
          style={{
            position: 'fixed',
            top: -10,
            left: -10,
            width: 'calc(100% + 20px)',
            height: 'calc(100% + 20px)',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        />

        {/* ── Hero: radial overlay + tagline + CTA ── */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          padding: '160px 240px',
          background: 'radial-gradient(ellipse at center, rgba(8,8,8,0.85) 0%, rgba(8,8,8,0.6) 40%, transparent 70%)',
          pointerEvents: 'none',
        }}>
          <img
            src={taglineSvg}
            alt="One vault for every world you've visited."
            style={{ width: 'min(40vw, 500px)', display: 'block' }}
          />

          <button
            onClick={() => setShowLogin(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', pointerEvents: 'auto', lineHeight: 0 }}
          >
            <img src={openArchiveSvg} alt="Open your Archive" style={{ height: 35, display: 'block' }} />
          </button>
        </div>

        {/* ── Sign-in modal ── */}
        {showLogin && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(8,8,8,0.78)',
              backdropFilter: 'blur(6px)',
            }}
            onClick={() => setShowLogin(false)}
          >
            <div
              style={{
                background: '#111111',
                border: '1px solid #1E1E1E',
                borderRadius: 14,
                padding: '36px 32px',
                width: 340,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#D4AF6A', letterSpacing: '0.06em' }}>
                Sign In
              </h2>
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={INPUT_STYLE}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={INPUT_STYLE}
                />
                {loginError && (
                  <p style={{ margin: 0, fontSize: 13, color: '#C0392B' }}>{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    background: '#D4AF6A',
                    color: '#080808',
                    border: 'none',
                    borderRadius: 8,
                    padding: '11px',
                    fontSize: 14,
                    fontWeight: 600,
                    marginTop: 4,
                    opacity: loginLoading ? 0.6 : 1,
                  }}
                >
                  {loginLoading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
