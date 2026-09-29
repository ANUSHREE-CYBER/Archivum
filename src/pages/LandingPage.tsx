import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import useSpotlightEffect, { SPOTLIGHT_MAX_ALPHA } from '../lib/useSpotlightEffect'
import { useTilt } from '../lib/useTilt'
import { STATUS_COLORS, STATUS_TEXT_COLORS } from '../lib/statusColors'

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

// Remote covers used in more than one place (hero collage + Collection stack)
const ANILIST_BERSERK   = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002-7EzO7o21jzeF.jpg'
const ANILIST_ONE_PIECE = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/nx21-tXMN3Y20PIL9.jpg'

interface PosterDef {
  url: string
  width: number
  // % of the viewport, as in the original flat collage
  top: string
  left: string
  rotate: number
  duration: number
  delay: number
}

// The hero collage. Positions are unchanged from the flat version; the
// fly-through below keeps every poster exactly where it sat on screen and
// only adds depth. Seven entries were removed here because their URLs 404:
// AniList bx105398, bx31148, bx105778, bx1535 and TMDB dvXJgEDQ…, vcWCfKkX…,
// qJ2tW6WM…. (onError still hides any future casualty.)
const POSTERS: PosterDef[] = [
  { url: 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',                        width: 140, top:  '1.6%', left: '20.5%', rotate:  -8, duration: 6.0, delay: 0.0 },
  { url: imgDarkKnight,                                                                                width: 100, top:  '2.4%', left: '40.2%', rotate:   5, duration: 5.0, delay: 0.7 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4pEFseh.jpg', width: 120, top:  '6.3%', left: '56.8%', rotate: -10, duration: 4.5, delay: 1.4 },
  { url: imgFriends,                                                                                   width:  85, top: '13.8%', left: '48.8%', rotate:   7, duration: 7.0, delay: 2.1 },
  { url: 'https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',                         width: 120, top: '12.4%', left: '78.9%', rotate:   9, duration: 3.5, delay: 1.8 },
  { url: 'https://image.tmdb.org/t/p/w342/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',                        width: 140, top: '11.8%', left: '90.4%', rotate:  11, duration: 5.5, delay: 1.2 },
  { url: imgVigilante,                                                                                 width: 100, top:  '5.2%', left: '10.9%', rotate:  -6, duration: 6.5, delay: 0.4 },
  { url: ANILIST_BERSERK,                                                                              width:  85, top: '16.7%', left: '32.4%', rotate:   9, duration: 4.5, delay: 1.7 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-C6FPmWm59CyP.jpg',  width:  85, top: '40.7%', left: '76.7%', rotate:  -9, duration: 6.0, delay: 1.5 },
  { url: 'https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',                         width:  85, top: '42.4%', left: '85.6%', rotate:   4, duration: 4.0, delay: 2.3 },
  { url: 'https://image.tmdb.org/t/p/w342/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',                         width: 100, top:  '8.5%', left:  '1.6%', rotate:  -4, duration: 5.5, delay: 1.1 },
  { url: ANILIST_ONE_PIECE,                                                                            width:  85, top: '37.1%', left: '18.4%', rotate:   8, duration: 3.5, delay: 0.6 },
  { url: imgTheRookie,                                                                                  width:  85, top:   '38%', left:  '0.6%', rotate:  -7, duration: 6.0, delay: 1.9 },
  { url: imgVincenzoLocal,                                                                              width: 100, top:   '63%', left: '80.8%', rotate:   5, duration: 4.5, delay: 0.8 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx108556-NHjkz0BNJhLx.jpg', width:  85, top: '87.5%', left: '80.1%', rotate: -11, duration: 7.0, delay: 2.5 },
  { url: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-PEn1CTc93blC.jpg', width:  85, top: '46.2%', left: '94.2%', rotate:   6, duration: 3.5, delay: 0.3 },
  { url: imgAotManga,                                                                                   width:  85, top: '12.8%', left: '69.4%', rotate:  -6, duration: 3.0, delay: 2.0 },
  { url: imgDemonSlayer,                                                                                width: 140, top: '65.3%', left:  '1.6%', rotate:  -9, duration: 6.0, delay: 0.4 },
  { url: imgJudgeFromHell,                                                                              width: 120, top:   '36%', left:    '9%', rotate:   5, duration: 4.5, delay: 1.6 },
  { url: imgDeathNoteManga,                                                                             width: 100, top: '69.8%', left: '49.8%', rotate:  -3, duration: 6.5, delay: 0.3 },
  { url: imgSoloLeveling,                                                                               width:  85, top: '63.5%', left: '59.7%', rotate:   6, duration: 4.0, delay: 2.3 },
  { url: imgTopGun,                                                                                    width: 120, top: '62.7%', left:   '70%', rotate:   9, duration: 3.0, delay: 0.6 },
  { url: imgKillBill,                                                                                   width: 140, top: '67.9%', left: '90.1%', rotate:   8, duration: 6.5, delay: 1.1 },
  { url: imgSnapped,                                                                                    width: 100, top:   '60%', left:   '18%', rotate:  -6, duration: 5.2, delay: 0.3 },
  { url: imgHannibal,                                                                                   width: 120, top:   '72%', left:   '30%', rotate:   7, duration: 4.8, delay: 1.1 },
  { url: imgGhostInTheShell,                                                                            width:  85, top:   '80%', left:   '15%', rotate:  -4, duration: 6.1, delay: 0.7 },
  { url: imgSalt,                                                                                       width: 100, top:   '75%', left:   '42%', rotate:   5, duration: 5.5, delay: 1.8 },
]

// Each poster's depth, in px behind the screen plane: a scrambled spread
// from -60 to -1360 so neighbours sit at different distances. Fixed per
// index rather than random, so the scene is identical on every visit.
const HERO_POSTERS = POSTERS.map((p, i) => ({
  ...p,
  topPct: parseFloat(p.top),
  leftPct: parseFloat(p.left),
  z: -Math.round((((i * 397) % 13) / 12) * 1300) - 60,
}))

// Revealed one by one mid fly-through, centred over the scene
const TYPE_WORDS = ['Films', '·', 'Series', '·', 'K-drama', '·', 'Anime', '·', 'Books', '·', 'Manga', '·', 'Manhwa']

// ── "The Collection" index ───────────────────────────────────────────────
// The seven content types the vault tracks, in shelf order, each with the
// three posters its stack shows. Numbering is derived from the array index,
// so reordering here reorders the plate. `null` is a placeholder slot:
// Literature and Manhwa still need real cover images (see `placeholder`).
const COLLECTION_TYPES: { name: string; tag: string; cards: (string | null)[]; placeholder?: string }[] = [
  { name: 'Film',         tag: 'Movies', cards: [imgDarkKnight, imgKillBill, imgTopGun] },
  { name: 'Television',   tag: 'TV',     cards: [imgFriends, imgHannibal, imgTheRookie] },
  { name: 'Korean Drama', tag: 'Kdrama', cards: [imgVigilante, imgVincenzoLocal, imgJudgeFromHell] },
  { name: 'Anime',        tag: 'Anime',  cards: [imgGhostInTheShell, imgDemonSlayer, ANILIST_ONE_PIECE] },
  { name: 'Literature',   tag: 'Books',  cards: [null, null, null], placeholder: 'book cover' },
  { name: 'Manga',        tag: 'Manga',  cards: [imgDeathNoteManga, imgAotManga, ANILIST_BERSERK] },
  { name: 'Manhwa',       tag: 'Manhwa', cards: [null, imgSoloLeveling, null], placeholder: 'manhwa cover' },
]

// The Shelf: sixteen posters stood around a ring
const RING_POSTERS = [
  imgDarkKnight, imgDemonSlayer, imgVincenzoLocal, imgFriends, imgDeathNoteManga, imgKillBill,
  imgSoloLeveling, imgHannibal, imgGhostInTheShell, imgTopGun, imgAotManga, imgJudgeFromHell,
  imgTheRookie, imgVigilante, imgSalt, imgSnapped,
]

// ── "Plate I" vault peek ─────────────────────────────────────────────────
// Static mockup only — no Supabase, no auth, nothing here reaches the real
// vault. Colors come from statusColors.ts so the peek can't drift from the
// real badges; only the labels are local, since the vault derives its own from
// the entry's type (a book is "Plan to Read", not "Plan to Watch") and the
// mockup has no entries to derive from.
const PEEK_LABELS: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  plan_to_watch: 'Plan to Watch',
  on_hold: 'On Hold',
  dropped: 'Dropped',
}

const PEEK_CARDS: { url: string; title: string; status: keyof typeof PEEK_LABELS }[] = [
  { url: imgHannibal,         title: 'Hannibal',           status: 'completed' },
  { url: imgSoloLeveling,     title: 'Solo Leveling',      status: 'in_progress' },
  { url: imgGhostInTheShell,  title: 'Ghost in the Shell', status: 'plan_to_watch' },
  { url: imgJudgeFromHell,    title: 'Judge from Hell',    status: 'on_hold' },
  { url: imgSalt,             title: 'Salt',               status: 'dropped' },
  { url: imgSnapped,          title: 'Snapped',            status: 'completed' },
]

// ── Edge bleed ───────────────────────────────────────────────────────────
// Ambient posters that run off the left/right margins of the two scroll
// sections so they read as a continuation of the hero's room rather than
// black voids. Deliberately none of the six in PEEK_CARDS above — the Plate's
// mockup posters are the crisp, in-focus ones and shouldn't have a blurred
// twin a few hundred pixels away. Positions are % of the section box, so they
// track its height instead of needing a fixed one.
interface EdgePoster {
  url: string
  width: number
  top?: string
  bottom?: string
  left?: string
  right?: string
  rotate: number
}

const COLLECTION_EDGE_POSTERS: EdgePoster[] = [
  { url: imgFriends,         width: 190, top:  '2%', left:  '-6%', rotate: -7 },
  { url: imgTopGun,          width: 155, top: '54%', left:  '-4%', rotate:  5 },
  { url: imgDeathNoteManga,  width: 170, top:  '8%', right: '-5%', rotate:  8 },
  { url: imgVincenzoLocal,   width: 200, top: '60%', right: '-7%', rotate: -5 },
]

const PLATE_EDGE_POSTERS: EdgePoster[] = [
  { url: imgKillBill,     width: 205, top:   '14%', left:  '-8%', rotate:  6 },
  { url: imgAotManga,     width: 150, bottom: '-4%', left:  '-2%', rotate: -4 },
  { url: imgDemonSlayer,  width: 180, top:   '26%', right: '-6%', rotate: -8 },
  { url: imgTheRookie,    width: 145, bottom: '2%', right: '-3%', rotate:  7 },
]

// Password visibility glyph. Same hand-written idiom as the rest of the app's
// icons (Dropdown's chevron, the vault header's control icons) — there's no
// icon library installed and three shapes don't justify adding one. The almond
// and pupil stay put between states so the toggle reads as one object gaining
// a slash, not two unrelated pictures swapping.
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.3 8S4 3.6 8 3.6 14.7 8 14.7 8 12 12.4 8 12.4 1.3 8 1.3 8Z" />
      <circle cx="8" cy="8" r="1.9" />
      {off && <path d="M2.7 2.7 13.3 13.3" />}
    </svg>
  )
}

function EdgeBleed({ posters }: { posters: EdgePoster[] }) {
  return (
    <div className="lp-edge-layer" aria-hidden="true">
      {posters.map((p, i) => (
        <img
          key={i}
          src={p.url}
          alt=""
          className="lp-edge-poster"
          loading="lazy"
          decoding="async"
          style={{
            width: p.width,
            top: p.top,
            bottom: p.bottom,
            left: p.left,
            right: p.right,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// ── Scroll maths ─────────────────────────────────────────────────────────
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// How far the window has scrolled through a tall section whose content is a
// 100vh sticky viewport: 0 as its top reaches the top of the window, 1 as its
// bottom reaches the bottom. Every scroll-driven chapter below reads this.
function sectionProgress(el: HTMLElement | null) {
  if (!el) return 0
  const r = el.getBoundingClientRect()
  return clamp01(-r.top / (r.height - window.innerHeight))
}

// Scroll the window (never scrollIntoView — see the root div's overflow-x
// note) to a given progress point inside a scroll-driven section
function scrollToProgress(el: HTMLElement | null, p: number) {
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY + p * (el.offsetHeight - window.innerHeight)
  window.scrollTo({ top, behavior: REDUCED_MOTION ? 'auto' : 'smooth' })
}

const CHAPTERS = ['I — Entrance', 'II — The Collection', 'III — The Vault', 'IV — The Shelf', 'V — The Door']

// One card of the Plate mockup. The outer div is driven by the scroll loop
// (it drops into place); the inner one tilts under the pointer — separate
// layers so neither overwrites the other's transform.
function PlateCard({ card, setRef }: {
  card: typeof PEEK_CARDS[number]
  setRef: (el: HTMLDivElement | null) => void
}) {
  const { tiltRef, glareRef, onMouseMove, onMouseLeave } = useTilt({
    max: 9,
    lift: 'translateZ(40px)',
    perspective: 900,
    glare: 0.35,
  })
  return (
    <div ref={setRef} className="lp-plate-peek">
      <div ref={tiltRef} className="lp-plate-card" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
        <div className="lp-plate-poster-frame">
          <img src={card.url} alt="" className="lp-plate-poster" loading="lazy" decoding="async" />
          <div ref={glareRef} className="lp-plate-glare" />
        </div>
        <span
          className="lp-plate-badge"
          style={{
            background: STATUS_COLORS[card.status],
            color: STATUS_TEXT_COLORS[card.status],
          }}
        >
          {PEEK_LABELS[card.status]}
        </span>
        <span className="lp-plate-name">{card.title}</span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError]     = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  // The only piece of scroll state that goes through React: which of the
  // seven Collection types is active. It changes seven times over the whole
  // section; everything that moves per frame is written to refs below.
  const [activeType, setActiveType] = useState(0)

  // Written by the scroll loop, read by the spotlight's own draw loop
  const spotAlphaRef = useRef(SPOTLIGHT_MAX_ALPHA)
  const spotlightCanvasRef = useSpotlightEffect({ alphaRef: spotAlphaRef })
  const showLoginRef = useRef(false)

  const heroRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const posterRefs = useRef<(HTMLDivElement | null)[]>([])
  const heroTextRef = useRef<HTMLDivElement>(null)
  const heroTextInnerRef = useRef<HTMLDivElement>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const heroEndRef = useRef<HTMLDivElement>(null)
  const colRef = useRef<HTMLElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const plateSectionRef = useRef<HTMLElement>(null)
  const plateRef = useRef<HTMLDivElement>(null)
  const peekRefs = useRef<(HTMLDivElement | null)[]>([])
  const ringSectionRef = useRef<HTMLElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const ringItemRefs = useRef<(HTMLDivElement | null)[]>([])
  const navBarRef = useRef<HTMLDivElement>(null)
  const navStepRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef({ on: false, x: 0, off: 0, vel: 0 })

  useEffect(() => {
    showLoginRef.current = showLogin
  }, [showLogin])

  // The whole page's motion: one requestAnimationFrame loop that reads scroll
  // progress and the (smoothed) pointer, and writes transforms/opacity
  // straight to DOM refs. React never re-renders per frame.
  useEffect(() => {
    const I = REDUCED_MOTION ? 0 : 1
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, sx: window.innerWidth / 2, sy: window.innerHeight / 2 }
    let activeNow = 0
    let chapterNow = ''
    let ringHidden = false
    let raf = 0

    function onMove(e: PointerEvent) {
      mouse.x = e.clientX
      mouse.y = e.clientY
      const drag = dragRef.current
      if (drag.on) {
        const dx = e.clientX - drag.x
        drag.x = e.clientX
        drag.off += dx * 0.25
        drag.vel = dx * 0.25
      }
    }
    function onUp() {
      dragRef.current.on = false
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)

    function frame(t: number) {
      const W = window.innerWidth
      const H = window.innerHeight
      mouse.sx += (mouse.x - mouse.sx) * 0.08
      mouse.sy += (mouse.y - mouse.sy) * 0.08
      const nx = mouse.sx / W - 0.5
      const ny = mouse.sy / H - 0.5

      // ── I. Hero fly-through ──
      const hp = sectionProgress(heroRef.current)
      const cam = easeOutCubic(hp) * 2100 * I
      if (sceneRef.current) {
        sceneRef.current.style.transform =
          `translateZ(${cam.toFixed(1)}px) rotateX(${(-ny * 7 * I).toFixed(2)}deg) rotateY(${(nx * 10 * I).toFixed(2)}deg)`
      }
      HERO_POSTERS.forEach((p, i) => {
        const el = posterRefs.current[i]
        if (!el) return
        // Scale each poster's on-screen offset by its depth factor so that,
        // seen through the 1000px perspective, it lands exactly where it sat
        // in the flat collage — the depth only shows once the camera moves.
        const f = 1 + -p.z / 1000
        const x = (p.leftPct / 100 * W + p.width / 2 - W / 2) * f
        const y = (p.topPct / 100 * H + p.width * 0.75 - H / 2) * f
        const s = 1 + (-p.z / 1000) * 0.55
        const float = I ? Math.sin((t / 1000) / p.duration * Math.PI + p.delay) * 6 : 0
        el.style.transform =
          `translate3d(${x.toFixed(1)}px, ${(y + float).toFixed(1)}px, ${p.z}px) rotate(${(p.rotate * (1 - hp * 0.6)).toFixed(2)}deg) scale(${s.toFixed(3)})`
        // Fade out just before a poster reaches the camera, then drop it
        const zc = p.z + cam
        el.style.opacity = String(zc > 650 ? Math.max(0, 1 - (zc - 650) / 300) : 1)
        el.style.visibility = zc > 960 ? 'hidden' : 'visible'
      })
      const textFade = 1 - smoothstep(0.02, 0.2, hp)
      if (heroTextRef.current) {
        heroTextRef.current.style.opacity = String(textFade)
        heroTextRef.current.style.visibility = textFade < 0.02 ? 'hidden' : 'visible'
      }
      if (heroTextInnerRef.current) {
        heroTextInnerRef.current.style.transform = `translateY(${(-hp * 120).toFixed(1)}px) scale(${(1 + hp * 0.5).toFixed(3)})`
      }
      wordRefs.current.forEach((el, i) => {
        if (!el) return
        const a = smoothstep(0.32 + i * 0.035, 0.4 + i * 0.035, hp) * (1 - smoothstep(0.78, 0.9, hp))
        el.style.opacity = String(a)
        el.style.transform = `translateY(${((1 - a) * 20).toFixed(1)}px) scale(${(0.9 + a * 0.1).toFixed(3)})`
      })
      if (heroEndRef.current) heroEndRef.current.style.opacity = String(smoothstep(0.86, 1, hp))

      // The lights come up as you scroll in. While the overlay is still dark
      // enough to *be* the cursor, the ring cursor stands aside — except
      // over the sign-in modal, which needs a pointer.
      const spotAlpha = SPOTLIGHT_MAX_ALPHA * (1 - smoothstep(0.04, 0.3, hp))
      spotAlphaRef.current = spotAlpha
      const hideRing = spotAlpha > 0.25 && !showLoginRef.current
      if (hideRing !== ringHidden) {
        ringHidden = hideRing
        document.documentElement.toggleAttribute('data-ring-hidden', hideRing)
      }

      // ── II. The Collection ──
      const cp = sectionProgress(colRef.current)
      const active = Math.min(6, Math.floor(cp * 7))
      if (active !== activeNow) {
        activeNow = active
        setActiveType(active)
      }
      if (stackRef.current) {
        stackRef.current.style.transform = `rotateY(${(nx * 14 * I).toFixed(2)}deg) rotateX(${(-ny * 10 * I).toFixed(2)}deg)`
      }

      // ── III. Plate I rises into place, then its cards drop in ──
      const pp = sectionProgress(plateSectionRef.current)
      const e = easeOutCubic(clamp01(pp / 0.5))
      if (plateRef.current) {
        plateRef.current.style.transform = I === 0
          ? 'none'
          : `rotateX(${((1 - e) * 58).toFixed(2)}deg) translateY(${((1 - e) * 160).toFixed(1)}px) scale(${(0.8 + 0.2 * e).toFixed(3)})`
      }
      peekRefs.current.forEach((el, k) => {
        if (!el) return
        const ek = I === 0 ? 1 : easeOutCubic(clamp01((pp - 0.22 - k * 0.045) / 0.28))
        el.style.transform =
          `translateZ(${((1 - ek) * 260).toFixed(1)}px) translateY(${((1 - ek) * -50).toFixed(1)}px) rotateX(${((1 - ek) * -30).toFixed(2)}deg)`
        el.style.opacity = String(ek)
      })

      // ── IV. The Shelf: scroll (and drag) turns the ring ──
      const rp = sectionProgress(ringSectionRef.current)
      const drag = dragRef.current
      if (!drag.on) {
        drag.off += drag.vel
        drag.vel *= 0.94
      }
      if (ringRef.current) {
        const R = Math.max(520, Math.min(760, W * 0.42))
        const n = RING_POSTERS.length
        const rot = -rp * 320 * Math.max(I, 0.3) + drag.off + (I ? (t / 1000) * 2 : 0)
        ringRef.current.style.transform =
          `translateZ(${-R}px) rotateX(${(-8 - ny * 6 * I).toFixed(2)}deg) rotateY(${rot.toFixed(2)}deg)`
        ringItemRefs.current.forEach((el, i) => {
          if (!el) return
          const a = (i * 360) / n
          el.style.transform = `rotateY(${a}deg) translateZ(${R}px)`
          // Posters facing the viewer are solid; ones turned away fade
          el.style.opacity = String(0.15 + 0.85 * Math.max(0, Math.cos(((a + rot) * Math.PI) / 180)))
        })
      }

      // ── Nav: reading progress + chapter ──
      const docMax = document.documentElement.scrollHeight - H
      if (navBarRef.current) navBarRef.current.style.transform = `scaleX(${docMax > 0 ? window.scrollY / docMax : 0})`
      const chapter = CHAPTERS[hp < 1 ? 0 : cp < 1 ? 1 : pp < 1 ? 2 : rp < 1 ? 3 : 4]
      if (chapter !== chapterNow && navStepRef.current) {
        chapterNow = chapter
        navStepRef.current.textContent = chapter
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.documentElement.removeAttribute('data-ring-hidden')
    }
  }, [])

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
        .lp-poster {
          display: block;
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
          border-radius: 8px;
        }

        /* ── Logo / tagline / CTA ──────────────────────────────────────────
           These three were exported Figma SVGs until the rose gold rebrand.
           The sizes below are the measured metrics of those exports at the
           sizes they were displayed at (logo 130px wide, tagline 500px wide,
           CTA pill 308x35), so the layout is unchanged. Georgia is a wider,
           lower-contrast face than the display serif in the artwork, so the
           tracking values are what land it on the same overall width. */
        .lp-serif {
          font-family: Georgia, 'Times New Roman', serif;
        }

        /* The artwork filled its letters with a 3-stop metallic sheen rather
           than a flat colour, so this paints the rose gold equivalent and
           clips it to the glyphs. The plain colour below is the fallback and
           the @supports block is what makes color:transparent safe — without
           the guard, a browser that can't clip a background to text would
           render invisible letters. For a flat fill instead, drop the
           @supports block entirely. */
        .lp-metal {
          color: var(--color-accent);
        }
        @supports (-webkit-background-clip: text) or (background-clip: text) {
          .lp-metal {
            background: linear-gradient(95deg,
              var(--color-accent-pale) 0%,
              var(--color-accent-dark) 65%,
              var(--color-accent) 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }
        }

        .lp-logo {
          display: inline-block;
          font-size: 27.4px;
          font-weight: 400;
          letter-spacing: 0.087em;
          line-height: 1;
          white-space: nowrap;
        }
        /* Small caps by hand, not font-variant-caps: Georgia ships no real
           small-cap glyphs, so browsers synthesise them at roughly 0.75 of
           cap height where the original artwork sits at 0.64. */
        .lp-logo-sc {
          font-size: 0.64em;
        }

        .lp-tagline {
          margin: 0;
          /* the box the <img> used to occupy; font-size is pinned to the same
             ratio so the two-line break and the proportions survive at any
             viewport width, exactly as scaling an image would */
          width: min(40vw, 500px);
          font-size: min(2.58vw, 32.3px);
          font-weight: 400;
          letter-spacing: 0.165em;
          line-height: 1.1;
          text-align: center;
        }

        .lp-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.7em;
          min-width: 308px;
          height: 35px;
          padding: 0 28px;
          border: 1px solid var(--color-accent);
          border-radius: 999px;
          background: transparent;
          color: var(--color-accent);
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          white-space: nowrap;
          /* the hero wrapper is pointer-events:none so the spotlight canvas
             stays interactive underneath it; the CTA has to opt back in */
          pointer-events: auto;
          transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        .lp-cta:hover {
          background: color-mix(in srgb, var(--color-accent) 12%, transparent);
          border-color: var(--color-accent-light);
          color: var(--color-accent-light);
        }
        /* letter-spacing is added after the last glyph too, which pushes the
           whole label visually left inside a centred pill; cancel it */
        .lp-cta-arrow {
          margin-right: -0.2em;
        }
        /* The hero CTA's exact shell, unpinned from its fixed pill width so it
           can fill a container. Must follow .lp-cta to win — same specificity. */
        .lp-cta-block {
          min-width: 0;
          width: 100%;
          height: 38px;
        }
        .lp-cta:disabled {
          opacity: 0.55;
        }

        /* ── Sign-in modal ─────────────────────────────────────────────────
           Scrim is a flat tint with NO backdrop-filter of its own, matching the
           vault modals. That's deliberate: an element with backdrop-filter
           becomes a backdrop root for its descendants, so blurring the scrim
           would leave the card's own blur with nothing behind it but the
           scrim's flat colour — the frost would silently do nothing.
           0.4 is the same value the vault modals settled on. */
        .lp-auth-scrim {
          position: fixed;
          inset: 0;
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(8, 8, 8, 0.4);
        }

        /* Same frosted recipe as EntryEditModal / ManualEntryModal */
        .lp-auth-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 340px;
          max-width: 100%;
          padding: 32px;
          border-radius: 14px;
          background: rgba(17, 17, 17, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.85);
        }

        .lp-auth-title {
          margin: 0;
          font-size: 21px;
          font-weight: 400;
          letter-spacing: 0.03em;
          /* accent-light rather than accent: the heading sits on the card's own
             lightened glass, and the deeper accent is spoken for by the button
             border right below it */
          color: var(--color-accent-light);
          text-align: center;
        }

        /* The vault's ◆ ornament at modal scale — same motif, two hairlines
           broken by the diamond. */
        .lp-auth-rule {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: -4px;
        }
        .lp-auth-rule::before,
        .lp-auth-rule::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.09);
        }
        .lp-auth-diamond {
          color: var(--color-accent);
          font-size: 7px;
          line-height: 1;
        }

        /* Border/radius/surface match the vault modals' inputs; the focus state
           is new — those rely on the browser default, which is a blue ring that
           belongs to no palette here. Lives in a class, not a style prop, since
           inline styles beat :focus. */
        .lp-auth-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 14px;
          border-radius: 8px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          font-size: 14px;
          outline: none;
          transition: border-color 0.18s ease, background-color 0.18s ease;
        }
        .lp-auth-input::placeholder {
          color: #6B6660;
        }
        .lp-auth-input:focus {
          border-color: var(--color-accent);
          background: #151515;
        }

        /* Password field: the toggle is absolutely positioned inside the
           input's box, so the wrapper (not the input) owns the positioning
           context. The input keeps its own border and focus state untouched —
           the button sits on top of it rather than the two being merged into
           a composite control, which is what keeps the focus ring correct. */
        .lp-auth-field {
          position: relative;
          display: flex;
        }
        /* clears the 32px button plus its inset, so typed text and the caret
           never run under the glyph */
        .lp-auth-input-password {
          padding-right: 42px;
        }
        .lp-auth-eye {
          position: absolute;
          top: 50%;
          right: 4px;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          /* 32px box around a 16px glyph — a comfortably separate hit target
             that still sits inside the input's 42px right gutter */
          width: 32px;
          height: 32px;
          padding: 0;
          border: none;
          background: none;
          border-radius: 7px;
          /* the placeholder's tone, so it reads as part of the input's own
             quiet furniture rather than a control competing with the form */
          color: #6B6660;
          transition: color 0.18s ease, background-color 0.18s ease;
        }
        .lp-auth-eye:hover {
          color: var(--color-text);
          background: rgba(255, 255, 255, 0.05);
        }
        .lp-auth-eye:focus-visible {
          color: var(--color-accent-light);
          outline: 1px solid var(--color-accent);
          outline-offset: -2px;
        }

        /* ── Scroll invitation under the CTA ──────────────────────────── */
        .lp-scroll-cue {
          display: inline-flex;
          align-items: center;
          gap: 0.8em;
          margin-top: -14px;
          background: none;
          border: none;
          padding: 6px 4px;
          font-family: system-ui, 'Segoe UI', sans-serif;
          font-size: 11px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #6B6660;
          pointer-events: auto;
          transition: color 0.2s ease;
        }
        .lp-scroll-cue:hover {
          color: var(--color-accent-light);
        }
        .lp-scroll-cue-arrow {
          display: inline-block;
          animation: scrollCueBob 2.4s ease-in-out infinite;
        }
        @keyframes scrollCueBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(4px); }
        }

        .lp-section-inner {
          /* lifts the real content above the edge-bleed layer below */
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 clamp(24px, 6vw, 72px);
        }

        /* ── Edge bleed ───────────────────────────────────────────────────
           Ambient posters running off the section's side margins. Purely
           decorative: the layer is aria-hidden and pointer-events:none, so it
           can't be hovered, tabbed to, or picked up by the hero's spotlight
           (which lives in the hero section and never scrolls down here). */
        .lp-edge-layer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .lp-edge-poster {
          position: absolute;
          display: block;
          aspect-ratio: 2/3;
          object-fit: cover;
          border-radius: 10px;
          /* far quieter than the hero collage, which sits at full opacity and
             is dimmed by the spotlight overlay instead. Blur + desaturation
             pushes these behind the content plane so they never compete with
             the index rows or the Plate's crisp mockup posters. */
          opacity: 0.17;
          filter: blur(4px) saturate(0.7);
        }
        /* Two washes, painted over the posters but under the content:
           - horizontal, so the middle of the section is back to flat
             background and nothing can drift under the text however the
             viewport is sized;
           - vertical, so a poster crossing a section boundary dissolves
             instead of being guillotined by overflow:hidden. */
        .lp-edge-layer::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, transparent 0%, #080808 27%, #080808 73%, transparent 100%),
            linear-gradient(180deg, #080808 0%, transparent 15%, transparent 85%, #080808 100%);
        }
        /* Below this width the section's own padding collapses and the text
           runs closer to the edges — there's no gutter left to bleed into, so
           the whole layer goes rather than crowd the content. */
        @media (max-width: 1100px) {
          .lp-edge-layer {
            display: none;
          }
        }
        .lp-eyebrow {
          display: block;
          font-size: 11px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        /* ── Nav ──────────────────────────────────────────────────────────
           Look unchanged; gains the current chapter on the right and a 1px
           reading-progress line along its bottom edge (scaleX written by the
           scroll loop). */
        .lp-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 28px;
          background: rgba(8, 8, 8, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .lp-nav-step {
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .lp-nav-track {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: rgba(242, 239, 233, 0.05);
        }
        .lp-nav-bar {
          height: 1px;
          background: linear-gradient(90deg, #96555F, #E4BCC3);
          transform-origin: 0 50%;
          transform: scaleX(0);
        }

        /* Every chapter is a tall runway with a 100vh sticky viewport; the
           runway's height is how much scrolling the chapter takes. Sticky
           works because the root uses overflow-x: clip, not hidden. */
        .lp-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
        }

        /* ── I. Hero fly-through ──────────────────────────────────────── */
        .lp-hero {
          position: relative;
          height: 340vh;
        }
        .lp-hero-viewport {
          perspective: 1000px;
          perspective-origin: 50% 50%;
        }
        .lp-hero-scene {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          will-change: transform;
        }
        /* Anchored at the viewport centre; the loop's translate3d puts each
           poster back at its collage position, at its own depth */
        .lp-hero-poster {
          position: absolute;
          left: 50%;
          top: 50%;
          transform-style: preserve-3d;
          will-change: transform, opacity;
        }
        .lp-hero-poster .lp-poster {
          box-shadow: 0 20px 50px -18px rgba(0, 0, 0, 0.9);
        }
        .lp-hero-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 5;
          pointer-events: none;
        }
        .lp-hero-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
          padding: 160px 240px;
          background: radial-gradient(ellipse at center, rgba(8,8,8,0.85) 0%, rgba(8,8,8,0.6) 40%, transparent 70%);
          pointer-events: none;
        }
        .lp-hero-text-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
        }
        .lp-hero-words {
          position: absolute;
          inset: 0;
          z-index: 11;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .lp-hero-words > div {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px 22px;
          max-width: 900px;
          padding: 0 24px;
        }
        .lp-hero-word {
          opacity: 0;
          font-style: italic;
          font-size: clamp(24px, 3.2vw, 44px);
          color: #F2EFE9;
          text-shadow: 0 2px 24px rgba(8, 8, 8, 0.95);
          will-change: transform, opacity;
        }
        .lp-hero-end {
          position: absolute;
          inset: 0;
          z-index: 12;
          background: #080808;
          opacity: 0;
          pointer-events: none;
        }

        /* ── II. The Collection ───────────────────────────────────────── */
        .lp-col {
          position: relative;
          height: 420vh;
        }
        .lp-col-viewport {
          display: flex;
          align-items: center;
        }
        .lp-col-grid {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 72px clamp(24px, 6vw, 72px) 0;
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
          gap: clamp(32px, 5vw, 72px);
          align-items: center;
        }
        .lp-collection-copy {
          margin: 22px 0 34px;
          font-style: italic;
          font-size: clamp(19px, 1.8vw, 25px);
          font-weight: 400;
          line-height: 1.55;
          color: #D8D2CA;
          text-wrap: pretty;
        }
        .lp-index-list {
          list-style: none;
          margin: 0;
          padding: 0;
          border-top: 1px solid #1A1A1A;
        }
        .lp-index-list > li {
          border-bottom: 1px solid #1A1A1A;
        }
        /* One row per type. The active row (the one the stack is showing)
           brightens, grows and steps right; rows already passed go quiet. */
        .lp-index-row {
          display: flex;
          align-items: baseline;
          gap: 18px;
          width: 100%;
          padding: 13px 0;
          border: none;
          background: none;
          text-align: left;
          color: inherit;
        }
        .lp-index-num {
          flex: none;
          width: 2.2em;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--color-accent-dark);
          transition: color 0.35s ease;
        }
        .lp-index-name {
          flex: none;
          font-style: italic;
          font-size: clamp(17px, 1.5vw, 21px);
          color: #E8E3DB;
          transition: all 0.45s cubic-bezier(.2, .8, .2, 1);
        }
        /* the rule has to sit on its own baseline-independent line, hence the
           relative nudge — a flex item stretched between two baseline-aligned
           neighbours would otherwise ride the text baseline exactly */
        .lp-index-rule {
          flex: 1 1 auto;
          height: 1px;
          min-width: 24px;
          position: relative;
          bottom: 5px;
          background: #242424;
          transform-origin: 0 50%;
          transform: scaleX(0.6);
          transition: all 0.45s ease;
        }
        .lp-index-tag {
          flex: none;
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: #6B6660;
          transition: color 0.35s ease;
        }
        .lp-index-row.is-past .lp-index-name {
          color: var(--color-text-muted);
        }
        .lp-index-row.is-active .lp-index-num,
        .lp-index-row.is-active .lp-index-tag,
        .lp-index-row:hover .lp-index-num,
        .lp-index-row:hover .lp-index-tag {
          color: var(--color-accent);
        }
        .lp-index-row.is-active .lp-index-name {
          color: #FFFFFF;
          font-size: clamp(20px, 1.9vw, 26px);
          transform: translateX(10px);
        }
        .lp-index-row:hover .lp-index-name {
          color: #FFFFFF;
        }
        .lp-index-row.is-active .lp-index-rule {
          background: var(--color-accent-dark);
          transform: scaleX(1);
        }

        .lp-col-stage {
          position: relative;
          height: min(560px, 70vh);
          perspective: 1200px;
        }
        .lp-col-numeral {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-style: italic;
          font-size: clamp(180px, 22vw, 320px);
          line-height: 1;
          letter-spacing: -0.02em;
          color: transparent;
          -webkit-text-stroke: 1px rgba(183, 110, 121, 0.28);
          pointer-events: none;
        }
        .lp-col-stack {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
        }
        .lp-col-card {
          position: absolute;
          left: 50%;
          top: 46%;
          width: min(200px, 15vw);
          aspect-ratio: 2 / 3;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #1E1E1E;
          background: #0C0C0C;
          box-shadow: 0 40px 70px -24px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(183, 110, 121, 0.08);
          transition-property: transform, opacity;
          transition-duration: 0.9s, 0.6s;
          transition-timing-function: cubic-bezier(.2, .8, .2, 1), ease;
        }
        .lp-col-card img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        /* Stand-in until real Books / Manhwa covers are added */
        .lp-col-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-end;
          padding: 14px;
          background: repeating-linear-gradient(135deg, #131313 0 10px, #171717 10px 20px);
        }
        .lp-col-placeholder span {
          font-family: ui-monospace, Menlo, Consolas, monospace;
          font-size: 11px;
          color: var(--color-text-muted);
        }
        .lp-col-caption {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .lp-col-caption-tag,
        .lp-col-caption-diamond {
          color: var(--color-accent);
        }
        .lp-col-caption-diamond {
          font-size: 7px;
          letter-spacing: 0;
        }

        /* ── III. Plate I ─────────────────────────────────────────────── */
        .lp-plate-section {
          position: relative;
          height: 260vh;
        }
        .lp-plate-viewport {
          display: flex;
          align-items: center;
        }
        .lp-plate-inner {
          padding-top: 72px;
          perspective: 1400px;
        }
        .lp-plate-peek {
          transform-style: preserve-3d;
          will-change: transform, opacity;
        }
        .lp-plate-glare {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }

        /* ── IV. The Shelf ────────────────────────────────────────────── */
        .lp-ring-section {
          position: relative;
          height: 300vh;
        }
        .lp-ring-stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          perspective: 1300px;
          touch-action: pan-y;
          user-select: none;
        }
        .lp-ring-head {
          position: absolute;
          top: clamp(90px, 14vh, 130px);
          left: 0;
          right: 0;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 0 24px;
          pointer-events: none;
        }
        .lp-ring-title {
          margin: 0;
          font-weight: 400;
          font-style: italic;
          font-size: clamp(26px, 3vw, 40px);
          color: #E8E3DB;
          text-align: center;
        }
        /* A 1px point at the stage centre that the whole ring turns around */
        .lp-ring {
          position: relative;
          width: 1px;
          height: 1px;
          margin-top: 80px;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .lp-ring-item {
          position: absolute;
          left: -85px;
          top: -127px;
          width: 170px;
          backface-visibility: visible;
          will-change: transform, opacity;
        }
        .lp-ring-item img {
          display: block;
          width: 100%;
          aspect-ratio: 2 / 3;
          object-fit: cover;
          border-radius: 10px;
          border: 1px solid #1E1E1E;
          box-shadow: 0 30px 60px -24px rgba(0, 0, 0, 0.9);
          pointer-events: none;
        }
        .lp-ring-hint {
          position: absolute;
          bottom: clamp(40px, 8vh, 70px);
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: #6B6660;
          pointer-events: none;
        }

        /* ── V. Closing ───────────────────────────────────────────────── */
        .lp-closing {
          position: relative;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 34px;
          padding: 120px 24px;
          background: radial-gradient(ellipse at 50% 60%, rgba(183, 110, 121, 0.12) 0%, transparent 60%);
        }
        .lp-closing-rule {
          display: flex;
          align-items: center;
          gap: 14px;
          width: min(320px, 80vw);
        }
        .lp-closing-rule > span:not(.lp-closing-diamond) {
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.09);
        }
        .lp-closing-diamond {
          color: var(--color-accent);
          font-size: 8px;
        }
        .lp-closing-title {
          margin: 0;
          max-width: 640px;
          font-weight: 400;
          font-size: clamp(26px, 3.4vw, 44px);
          letter-spacing: 0.08em;
          line-height: 1.2;
          text-align: center;
        }

        /* ── Plate I: vault peek ──────────────────────────────────────── */
        .lp-plate-label {
          margin: 0 0 26px;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .lp-plate-frame {
          border: 1px solid #1E1E1E;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(17,17,17,0.9) 0%, rgba(10,10,10,0.9) 100%);
          padding: clamp(20px, 3vw, 34px);
          /* the double rule (frame + inset hairline) is the museum-plate
             cue — a mount board inside the frame, not just a box. The rose
             drop shadow is the plate's "light" as it rises into place. */
          box-shadow: inset 0 0 0 1px rgba(242, 239, 233, 0.03), 0 60px 120px -40px rgba(183, 110, 121, 0.25);
          transform-style: preserve-3d;
          transform-origin: 50% 100%;
          will-change: transform;
        }
        .lp-plate-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 16px;
          margin-bottom: 22px;
          border-bottom: 1px solid #1A1A1A;
        }
        .lp-plate-title {
          font-size: 19px;
          letter-spacing: 0.02em;
          color: #E8E3DB;
        }
        .lp-plate-counts {
          font-size: 11px;
          letter-spacing: 0.06em;
          color: #6B6660;
        }
        .lp-plate-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: clamp(10px, 1.4vw, 18px);
          transform-style: preserve-3d;
        }
        /* tilt layer (useTilt writes its transform on hover) */
        .lp-plate-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          transform-style: preserve-3d;
          transition: transform 0.18s ease-out;
        }
        .lp-plate-poster-frame {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #1E1E1E;
          background: #0C0C0C;
        }
        /* dimmed to sit behind the hero collage in the visual hierarchy —
           this is a mockup, it shouldn't out-shout the real artwork above */
        .lp-plate-poster {
          display: block;
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
          opacity: 0.55;
          transition: opacity 0.25s ease;
        }
        .lp-plate-card:hover .lp-plate-poster {
          opacity: 1;
        }
        .lp-plate-badge {
          /* flex items stretch by default, which would blow the pill out to
             the full card width — this keeps it hugging its label */
          align-self: flex-start;
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .lp-plate-name {
          font-size: 10px;
          line-height: 1.3;
          color: #6B6660;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .lp-plate-caption {
          margin: 26px 0 0;
          text-align: center;
          font-style: italic;
          font-size: 14px;
          line-height: 1.6;
          color: #6B6660;
        }

        @media (max-width: 900px) {
          .lp-col-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          /* no room for the 3D stack beside the list on a narrow screen */
          .lp-col-stage {
            display: none;
          }
          .lp-plate-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-scroll-cue-arrow {
            animation: none;
          }
        }
      `}</style>

      {/* overflow-x is `clip`, NOT `hidden`. They look identical here but
          differ in one decisive way: a `hidden` on one axis forces the other
          axis's `visible` to compute to `auto`, which quietly turned this div
          into a scroll container wrapping the whole page — swallowing
          scrollIntoView and (now) breaking every position: sticky chapter
          below. `clip` has no such side effect and creates no scroll
          container. */}
      <div style={{ position: 'relative', width: '100%', background: '#080808', overflowX: 'clip' }}>

        {/* ── Navbar: logo, current chapter, reading-progress hairline ── */}
        <nav className="lp-nav">
          <span className="lp-logo lp-serif lp-metal">A<span className="lp-logo-sc">RCHIVUM.</span></span>
          <span ref={navStepRef} className="lp-nav-step">{CHAPTERS[0]}</span>
          <div className="lp-nav-track" aria-hidden="true">
            <div ref={navBarRef} className="lp-nav-bar" />
          </div>
        </nav>

        {/* ── I. Hero fly-through ──
            A 340vh runway with a 100vh sticky viewport: scrolling through it
            moves the camera forward through the collage instead of moving
            the page. */}
        <section ref={heroRef} className="lp-hero">
          <div className="lp-sticky lp-hero-viewport">
            <div ref={sceneRef} className="lp-hero-scene">
              {HERO_POSTERS.map((p, i) => (
                <div
                  key={p.url}
                  ref={el => { posterRefs.current[i] = el }}
                  className="lp-hero-poster"
                  style={{ width: p.width, marginLeft: -p.width / 2, marginTop: -p.width * 0.75 }}
                >
                  <img
                    src={p.url}
                    alt=""
                    className="lp-poster"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              ))}
            </div>

            {/* Spotlight canvas: absolute inside the sticky viewport, so its
                overlay belongs to the hero alone. Its darkness is driven by
                spotAlphaRef and fades out over the first third of the hero. */}
            <canvas ref={spotlightCanvasRef} className="lp-hero-canvas" />

            <div ref={heroTextRef} className="lp-hero-text">
              <div ref={heroTextInnerRef} className="lp-hero-text-inner">
                <h1 className="lp-tagline lp-serif lp-metal">
                  One vault for every world you've visited.
                </h1>

                <button onClick={() => setShowLogin(true)} className="lp-cta lp-serif">
                  Open your Archive
                  <span className="lp-cta-arrow" aria-hidden="true">→</span>
                </button>

                <button onClick={() => scrollToProgress(heroRef.current, 0.62)} className="lp-scroll-cue">
                  Scroll to enter
                  <span className="lp-scroll-cue-arrow" aria-hidden="true">↓</span>
                </button>
              </div>
            </div>

            <div className="lp-hero-words" aria-hidden="true">
              <div>
                {TYPE_WORDS.map((w, i) => (
                  <span key={i} ref={el => { wordRefs.current[i] = el }} className="lp-hero-word lp-serif">{w}</span>
                ))}
              </div>
            </div>

            {/* fades to the page colour as the hero ends, so the Collection
                arrives out of black rather than cutting in */}
            <div ref={heroEndRef} className="lp-hero-end" aria-hidden="true" />
          </div>
        </section>

        {/* ── II. The Collection: scroll steps through the seven types ── */}
        <section ref={colRef} id="collection" className="lp-col">
          <div className="lp-sticky lp-col-viewport">
            <EdgeBleed posters={COLLECTION_EDGE_POSTERS} />
            <div className="lp-col-grid">
              <div>
                <span className="lp-eyebrow">The Collection</span>
                <p className="lp-collection-copy lp-serif">
                  An index of everywhere you've been — no ranking, no feed, no
                  noise. Only the record, kept in order.
                </p>
                <ol className="lp-index-list">
                  {COLLECTION_TYPES.map((type, i) => (
                    <li key={type.tag}>
                      <button
                        type="button"
                        onClick={() => scrollToProgress(colRef.current, (i + 0.5) / 7)}
                        aria-current={i === activeType}
                        className={`lp-index-row${i === activeType ? ' is-active' : i < activeType ? ' is-past' : ''}`}
                      >
                        <span className="lp-index-num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="lp-index-name lp-serif">{type.name}</span>
                        <span className="lp-index-rule" aria-hidden="true" />
                        <span className="lp-index-tag">{type.tag}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="lp-col-stage" aria-hidden="true">
                <span className="lp-col-numeral lp-serif">{String(activeType + 1).padStart(2, '0')}</span>
                <div ref={stackRef} className="lp-col-stack">
                  {COLLECTION_TYPES.map((type, ti) => type.cards.map((url, s) => {
                    // Active type fans its three cards; earlier types have
                    // flipped away upward, later ones wait below
                    const off = s - 1
                    const tf = ti === activeType
                      ? `translateX(${off * 165}px) translateZ(${s === 1 ? 90 : -40}px) rotateY(${-off * 26}deg) rotateZ(${off * 4}deg)`
                      : ti < activeType
                        ? `translateY(-460px) translateZ(-320px) rotateX(70deg) rotateZ(${off * 10}deg)`
                        : `translateY(460px) translateZ(-320px) rotateX(-70deg) rotateZ(${off * -10}deg)`
                    return (
                      <div
                        key={`${type.tag}-${s}`}
                        className="lp-col-card"
                        style={{
                          transform: `translate(-50%, -50%) ${tf}`,
                          opacity: ti === activeType ? 1 : 0,
                          zIndex: s === 1 ? 3 : 1,
                          transitionDelay: `${s * 70}ms`,
                        }}
                      >
                        {url ? (
                          <img src={url} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <div className="lp-col-placeholder"><span>{type.placeholder}</span></div>
                        )}
                      </div>
                    )
                  }))}
                </div>
                <div className="lp-col-caption">
                  <span className="lp-col-caption-tag">{COLLECTION_TYPES[activeType].tag}</span>
                  <span className="lp-col-caption-diamond">◆</span>
                  <span>{activeType + 1} / 7</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── III. Plate I: static vault preview (mockup, no live data) ──
            Tips up from the floor into place, then its cards drop in */}
        <section ref={plateSectionRef} className="lp-plate-section">
          <div className="lp-sticky lp-plate-viewport">
            <EdgeBleed posters={PLATE_EDGE_POSTERS} />
            <div className="lp-section-inner lp-plate-inner">
              <p className="lp-plate-label">Plate I — The Vault</p>

              <div ref={plateRef} className="lp-plate-frame" aria-hidden="true">
                <div className="lp-plate-header">
                  <span className="lp-plate-title lp-serif">The Vault</span>
                  <span className="lp-plate-counts">
                    6 titles · 2 completed · 1 in progress
                  </span>
                </div>

                <div className="lp-plate-grid">
                  {PEEK_CARDS.map((card, k) => (
                    <PlateCard key={card.title} card={card} setRef={el => { peekRefs.current[k] = el }} />
                  ))}
                </div>
              </div>

              <p className="lp-plate-caption lp-serif">
                The Vault at rest — every title finds its shelf, its status, its
                quiet place in the record.
              </p>
            </div>
          </div>
        </section>

        {/* ── IV. The Shelf: a ring of posters that scroll (or drag) turns ── */}
        <section ref={ringSectionRef} className="lp-ring-section">
          <div
            className="lp-sticky lp-ring-stage"
            onPointerDown={e => {
              dragRef.current.on = true
              dragRef.current.x = e.clientX
            }}
          >
            <div className="lp-ring-head">
              <span className="lp-eyebrow">The Shelf</span>
              <h2 className="lp-ring-title lp-serif">Every world, one turn of the shelf.</h2>
            </div>
            <div ref={ringRef} className="lp-ring" aria-hidden="true">
              {RING_POSTERS.map((url, i) => (
                <div key={url} ref={el => { ringItemRefs.current[i] = el }} className="lp-ring-item">
                  <img src={url} alt="" draggable={false} loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
            <span className="lp-ring-hint">Scroll or drag to turn</span>
          </div>
        </section>

        {/* ── V. Closing ── */}
        <section className="lp-closing">
          <div className="lp-closing-rule" aria-hidden="true">
            <span /><span className="lp-closing-diamond">◆</span><span />
          </div>
          <h2 className="lp-closing-title lp-serif lp-metal">The door is open.</h2>
          <button onClick={() => setShowLogin(true)} className="lp-cta lp-serif">
            Open your Archive
            <span className="lp-cta-arrow" aria-hidden="true">→</span>
          </button>
        </section>

        {/* ── Sign-in modal ── */}
        {showLogin && (
          <div className="lp-auth-scrim" onClick={() => setShowLogin(false)}>
            <div className="lp-auth-card" onClick={e => e.stopPropagation()}>
              <h2 className="lp-auth-title lp-serif">Sign In</h2>

              <div className="lp-auth-rule" aria-hidden="true">
                <span className="lp-auth-diamond">◆</span>
              </div>

              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="lp-auth-input"
                />
                <div className="lp-auth-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="lp-auth-input lp-auth-input-password"
                  />
                  {/* type="button" is load-bearing: a bare <button> inside a
                      <form> defaults to type="submit", so toggling visibility
                      would attempt a sign-in. */}
                  <button
                    type="button"
                    className="lp-auth-eye"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon off={!showPassword} />
                  </button>
                </div>
                {loginError && (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="lp-cta lp-cta-block lp-serif"
                  style={{ marginTop: 6 }}
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
