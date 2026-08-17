import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import useSpotlightEffect from '../lib/useSpotlightEffect'
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

// ── "The Collection" index ───────────────────────────────────────────────
// The seven content types the vault tracks, in shelf order. Numbering is
// derived from the array index, so reordering here reorders the plate.
const COLLECTION_TYPES: { name: string; tag: string }[] = [
  { name: 'Film',         tag: 'Movies' },
  { name: 'Television',   tag: 'TV' },
  { name: 'Korean Drama', tag: 'Kdrama' },
  { name: 'Anime',        tag: 'Anime' },
  { name: 'Literature',   tag: 'Books' },
  { name: 'Manga',        tag: 'Manga' },
  { name: 'Manhwa',       tag: 'Manhwa' },
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

// Height cleared for the fixed navbar when scrolling a section to the top.
// Matches .lp-section's scroll-margin-top.
const NAV_OFFSET = 72

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

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError]     = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const spotlightCanvasRef = useSpotlightEffect()

  function scrollToCollection() {
    const target = document.getElementById('collection')
    if (!target) return
    // Honour the OS "reduce motion" setting: a long smooth scroll is exactly
    // the kind of large-area movement that setting exists to suppress.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Deliberately window.scrollTo rather than target.scrollIntoView().
    // scrollIntoView walks up the ancestor chain and scrolls whichever scroll
    // container it meets first — so any wrapper that acquires an `auto`
    // overflow (see the root div's overflow-x note) silently absorbs the call
    // and nothing moves. Addressing the window directly can't be intercepted
    // that way. NAV_OFFSET replaces the scroll-margin-top scrollIntoView would
    // have honoured; that rule stays for real #collection anchor links.
    const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
  }

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

        /* ── Sections below the hero ──────────────────────────────────────
           The hero hides the OS cursor (the spotlight canvas *is* the cursor
           there), and index.css enforces that globally with
           \`* { cursor: none !important }\`. There's no spotlight down here, so
           the pointer has to come back or these sections feel dead. A class
           selector outranks the universal one, so this wins without needing
           to touch the global rule. */
        .lp-section,
        .lp-section * {
          cursor: auto !important;
        }
        .lp-section a,
        .lp-section button {
          cursor: pointer !important;
        }

        .lp-section {
          position: relative;
          z-index: 2;
          padding: clamp(88px, 12vh, 140px) 0;
          /* clears the fixed navbar when scrolled to via the CTA cue */
          scroll-margin-top: 72px;
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

        /* ── The Collection ───────────────────────────────────────────── */
        .lp-collection {
          display: grid;
          grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
          gap: clamp(40px, 6vw, 88px);
          align-items: start;
        }
        .lp-collection-copy {
          margin: 22px 0 0;
          font-style: italic;
          font-size: clamp(19px, 1.8vw, 25px);
          font-weight: 400;
          line-height: 1.55;
          color: #D8D2CA;
        }
        .lp-index-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .lp-index-row {
          display: flex;
          align-items: baseline;
          gap: 18px;
          padding: 15px 0;
          border-bottom: 1px solid #1A1A1A;
        }
        .lp-index-row:first-child {
          border-top: 1px solid #1A1A1A;
        }
        .lp-index-num {
          flex: none;
          width: 2.2em;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--color-accent-dark);
          transition: color 0.25s ease;
        }
        .lp-index-name {
          flex: none;
          font-style: italic;
          font-size: clamp(17px, 1.5vw, 21px);
          color: #E8E3DB;
          transition: color 0.25s ease;
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
          transition: background-color 0.25s ease;
        }
        .lp-index-tag {
          flex: none;
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: #6B6660;
          transition: color 0.25s ease;
        }
        .lp-index-row:hover .lp-index-num,
        .lp-index-row:hover .lp-index-tag {
          color: var(--color-accent);
        }
        .lp-index-row:hover .lp-index-name {
          color: #FFFFFF;
        }
        .lp-index-row:hover .lp-index-rule {
          background: var(--color-accent-dark);
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
             cue — a mount board inside the frame, not just a box */
          box-shadow: inset 0 0 0 1px rgba(242, 239, 233, 0.03);
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
        }
        .lp-plate-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
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
          .lp-collection {
            grid-template-columns: minmax(0, 1fr);
            gap: 40px;
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

      {/* The page scrolls now, so the root can no longer be a 100vh box with
          overflow:hidden — that clipping moved onto the hero section, which
          still needs it to keep the poster collage inside one viewport.

          overflow-x is `clip`, NOT `hidden`. They look identical here but
          differ in one decisive way: a `hidden` on one axis forces the other
          axis's `visible` to compute to `auto`, which quietly turned this div
          into a scroll container wrapping the whole page. `clip` has no such
          side effect and creates no scroll container. */}
      <div style={{ position: 'relative', width: '100%', background: '#080808', overflowX: 'clip' }}>

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
          <span className="lp-logo lp-serif lp-metal">A<span className="lp-logo-sc">RCHIVUM.</span></span>
        </nav>

        {/* ── Hero ── */}
        <section style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', cursor: 'none' }}>

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

        {/* ── Spotlight cursor canvas ──
            Absolute, not fixed: the darkening overlay belongs to the hero
            alone. Fixed, it would follow the scroll and black out the
            Collection and Plate sections below. The hook reads the canvas's
            getBoundingClientRect() each mousemove, so scroll offset is already
            accounted for and nothing else needs to change. */}
        <canvas
          ref={spotlightCanvasRef}
          style={{
            position: 'absolute',
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
          <h1 className="lp-tagline lp-serif lp-metal">
            One vault for every world you've visited.
          </h1>

          <button onClick={() => setShowLogin(true)} className="lp-cta lp-serif">
            Open your Archive
            <span className="lp-cta-arrow" aria-hidden="true">→</span>
          </button>

          <button onClick={scrollToCollection} className="lp-scroll-cue">
            See how it works
            <span className="lp-scroll-cue-arrow" aria-hidden="true">↓</span>
          </button>
        </div>

        </section>

        {/* ── The Collection: index of the seven content types ── */}
        <section id="collection" className="lp-section">
          <EdgeBleed posters={COLLECTION_EDGE_POSTERS} />
          <div className="lp-section-inner lp-collection">
            <div>
              <span className="lp-eyebrow">The Collection</span>
              <p className="lp-collection-copy lp-serif">
                An index of everywhere you've been — no ranking, no feed, no
                noise. Only the record, kept in order.
              </p>
            </div>

            <ol className="lp-index-list">
              {COLLECTION_TYPES.map((type, i) => (
                <motion.li
                  key={type.tag}
                  className="lp-index-row"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  /* once: the rows settle for good after the first pass —
                     re-animating on every scroll back up gets tiresome.
                     amount 0.5 waits until half the row is on screen so the
                     stagger reads as a cascade rather than firing all seven
                     the instant the list's top edge appears. */
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: 'easeOut' }}
                >
                  <span className="lp-index-num">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="lp-index-name lp-serif">{type.name}</span>
                  <span className="lp-index-rule" aria-hidden="true" />
                  <span className="lp-index-tag">{type.tag}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Plate I: static vault preview (mockup, no live data) ── */}
        <section className="lp-section">
          <EdgeBleed posters={PLATE_EDGE_POSTERS} />
          <motion.div
            className="lp-section-inner"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <p className="lp-plate-label">Plate I — The Vault</p>

            <div className="lp-plate-frame" aria-hidden="true">
              <div className="lp-plate-header">
                <span className="lp-plate-title lp-serif">The Vault</span>
                <span className="lp-plate-counts">
                  6 titles · 2 completed · 1 in progress
                </span>
              </div>

              <div className="lp-plate-grid">
                {PEEK_CARDS.map(card => (
                  <div key={card.title} className="lp-plate-card">
                    <div className="lp-plate-poster-frame">
                      <img
                        src={card.url}
                        alt=""
                        className="lp-plate-poster"
                        loading="lazy"
                        decoding="async"
                      />
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
                ))}
              </div>
            </div>

            <p className="lp-plate-caption lp-serif">
              The Vault at rest — every title finds its shelf, its status, its
              quiet place in the record.
            </p>
          </motion.div>
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
