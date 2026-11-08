"use client";
// Orchestrates the cinematic experience: one fixed WebGL canvas, a master
// scroll timeline (GSAP ScrollTrigger, native scrolling), HTML overlay
// panels, the scoreboard HUD, and the final convergence CTA. Falls back to a
// designed static story for reduced motion or when WebGL is unavailable.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { COPY } from "@/content/copy";
import { useBooking } from "@/lib/ui/BookingLauncher";
import { useMotion } from "@/lib/ui/MotionProvider";
import { CHAPTERS, JOURNEY_END, PANELS, panelOpacity, scrollState } from "../three/timeline";
import { SportArt } from "../art/SportArt";
import { Wordmark } from "../art/Wordmark";
import { BookCard, PlayCard, ReplayCard } from "./ChapterCards";
import { HeroSearch } from "./HeroSearch";
import { LoadingScreen } from "./LoadingScreen";

const Experience = dynamic(() => import("../three/Experience"), { ssr: false });

const JOURNEY_VH = 820;
const anchorTop = (t: number) => `${(t / JOURNEY_END) * (JOURNEY_VH - 100)}vh`;

export function Cinematic({ children }: { children: ReactNode }) {
  const { reduced, webgl, setWebglFailed } = useMotion();
  const cinematic = !reduced && webgl !== false;
  const [mountGL, setMountGL] = useState(false);
  const [glReady, setGlReady] = useState(false);
  // First-visit loading screen (only for the 3D experience, once per session).
  // Starts visible (also in the server HTML) so the page never flashes before it.
  const [showLoader, setShowLoader] = useState(true);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("playbook-loaded") === "1";
    } catch {
      /* ignore */
    }
    if (!cinematic || seen) setShowLoader(false);
  }, [cinematic]);
  const loaderDone = useCallback(() => {
    setShowLoader(false);
    try {
      sessionStorage.setItem("playbook-loaded", "1");
    } catch {
      /* ignore */
    }
  }, []);
  const [canvasOn, setCanvasOn] = useState(true);
  const [chapter, setChapter] = useState(-1);
  const journeyRef = useRef<HTMLElement>(null);
  const finalRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // Which 3D sections are on screen; the render loop also pauses while the booking dialog is open.
  const vis = useRef({ journey: false, final: false, dialog: false });
  const { isOpen: dialogOpen } = useBooking();
  const syncRender = useCallback(() => {
    const onScreen = vis.current.journey || vis.current.final;
    scrollState.setVisible(onScreen && !vis.current.dialog);
    setCanvasOn(onScreen);
  }, []);
  useEffect(() => {
    vis.current.dialog = dialogOpen;
    syncRender();
  }, [dialogOpen, syncRender]);

  // Mount WebGL only after first paint + fonts, so HTML booking UI is never blocked.
  useEffect(() => {
    if (!cinematic || !webgl) {
      setMountGL(false);
      setGlReady(false);
      return;
    }
    let alive = true;
    const go = () => alive && setMountGL(true);
    (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(go));
    return () => {
      alive = false;
    };
  }, [cinematic, webgl]);

  useEffect(() => {
    if (!cinematic) return;
    gsap.registerPlugin(ScrollTrigger);
    const journey = journeyRef.current!;
    const final = finalRef.current!;
    const panels = Array.from(journey.querySelectorAll<HTMLElement>("[data-panel]"));
    const syncVisible = syncRender;

    const applyPanels = (t: number) => {
      for (const el of panels) {
        const key = el.dataset.panel as keyof typeof PANELS;
        const o = panelOpacity(t, PANELS[key]);
        el.style.opacity = String(o);
        el.style.visibility = o > 0.01 ? "visible" : "hidden";
        el.style.transform = `translate3d(0, ${(1 - o) * 26}px, 0)`;
        const active = o > 0.5;
        el.classList.toggle("is-active", active);
        el.inert = !active;
      }
      let c = -1;
      CHAPTERS.forEach((ch, i) => {
        if (t >= ch.t - 0.02) c = i;
      });
      setChapter(c);
      boardRef.current?.style.setProperty("--p", String(Math.min(1, t)));
    };

    const triggers = [
      ScrollTrigger.create({
        trigger: journey,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const t = self.progress * JOURNEY_END;
          scrollState.target = t;
          applyPanels(t);
        },
      }),
      ScrollTrigger.create({
        trigger: journey,
        start: "top bottom",
        end: "bottom 8%",
        onToggle: (self) => {
          vis.current.journey = self.isActive;
          syncVisible();
        },
      }),
      ScrollTrigger.create({
        trigger: final,
        start: "top bottom",
        end: "bottom bottom",
        onUpdate: (self) => {
          scrollState.target = JOURNEY_END + self.progress * (1 - JOURNEY_END);
          boardRef.current?.style.setProperty("--p", String(scrollState.target));
          setChapter(self.progress > 0.2 ? 3 : 2);
        },
      }),
      ScrollTrigger.create({
        trigger: final,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => {
          vis.current.final = self.isActive;
          syncVisible();
        },
      }),
    ];
    applyPanels(scrollState.target);
    ScrollTrigger.refresh();
    // Sections below the journey grow once demo data loads; re-measure trigger
    // positions whenever the page height changes so the finale always fires.
    let raf = 0;
    let lastH = document.documentElement.scrollHeight;
    const ro = new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (h === lastH) return;
      lastH = h;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    });
    ro.observe(document.body);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      triggers.forEach((t) => t.kill());
      for (const el of panels) {
        el.inert = false;
      }
    };
  }, [cinematic]);

  const jumpTo = (i: number) => {
    const ch = CHAPTERS[i];
    let top: number;
    if (ch.id === "ft") {
      const f = finalRef.current!;
      top = f.getBoundingClientRect().top + window.scrollY + f.offsetHeight - window.innerHeight;
    } else {
      const j = journeyRef.current!;
      const target = ch.id === "book" ? PANELS.book.full + 0.02 : ch.id === "play" ? PANELS.play.full + 0.02 : PANELS.replay.full + 0.02;
      top = j.getBoundingClientRect().top + window.scrollY + (target / JOURNEY_END) * (j.offsetHeight - window.innerHeight);
    }
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  };

  if (!cinematic) {
    return (
      <>
        <StaticJourney webglFailed={webgl === false && !reduced} />
        {children}
        <FinalCTA staticMode />
      </>
    );
  }

  return (
    <>
      {showLoader && <LoadingScreen ready={glReady} onDone={loaderDone} />}
      <div className={`canvas-layer ${canvasOn ? "" : "is-hidden"}`} aria-hidden="true">
        <div className="canvas-fallback" />
        {mountGL && (
          <div style={{ position: "absolute", inset: 0, opacity: glReady ? 1 : 0, transition: "opacity 0.9s ease" }}>
            <Experience onReady={() => setGlReady(true)} onFail={setWebglFailed} />
          </div>
        )}
      </div>

      <div ref={boardRef} className={`scoreboard ${canvasOn ? "" : "is-hidden"}`} role="navigation" aria-label="Chapters">
        <div className="clock" aria-hidden="true">{chapter < 0 ? "PRE" : CHAPTERS[chapter].q}</div>
        {CHAPTERS.map((c, i) => (
          <button key={c.id} type="button" aria-current={chapter === i ? "step" : undefined} onClick={() => jumpTo(i)}>
            <span className="q">{c.q}</span>
            <span>{c.label}</span>
          </button>
        ))}
        <div className="bar" aria-hidden="true"><i /></div>
      </div>

      <section ref={journeyRef} className="journey stage" aria-label="Book, play, replay">
        <span id="how" style={{ position: "absolute", top: anchorTop(PANELS.book.full + 0.02) }} />
        <span id="chapter-play" style={{ position: "absolute", top: anchorTop(PANELS.play.full + 0.02) }} />
        <span id="chapter-replay" style={{ position: "absolute", top: anchorTop(PANELS.replay.full + 0.02) }} />
        <div className="sr-only">
          <h2>How Playbook works</h2>
          <h3>{COPY.chapters.book.heading}</h3>
          <p>{COPY.chapters.book.body}</p>
          <h3>{COPY.chapters.play.heading}</h3>
          <p>{COPY.chapters.play.body}</p>
          <h3>{COPY.chapters.replay.heading}</h3>
          <p>{COPY.chapters.replay.body}</p>
        </div>
        <div className="journey-sticky">
          <HeroPanel />
          <ChapterPanel id="book" card={<BookCard />} />
          <ChapterPanel id="play" card={<PlayCard />} right />
          <ChapterPanel id="replay" card={<ReplayCard />} />
        </div>
      </section>
      {children}
      <FinalCTA finalRef={finalRef} />
    </>
  );
}

function HeroPanel() {
  const { open } = useBooking();
  return (
    <div data-panel="hero" className="scene-panel hero is-active" style={{ opacity: 1, visibility: "visible" }}>
      <div className="inner">
        <div className="copy" style={{ maxWidth: 680 }}>
          <p className="eyebrow" style={{ color: "var(--lime)" }}>{COPY.hero.eyebrow}</p>
          <h1>
            Your next game <em>starts here.</em>
          </h1>
          <p className="lede">{COPY.hero.body}</p>
          <div className="hero-ctas hide-sm">
            <button type="button" className="btn" onClick={() => open()}>{COPY.hero.primary}</button>
            <a className="btn btn-ghost" href="#how">{COPY.hero.secondary}</a>
          </div>
          <div className="show-sm" style={{ marginTop: 18 }}>
            <HeroSearch compact />
            <a className="hero-venue-link" href="#how">{COPY.hero.secondary} ↓</a>
          </div>
          <a className="hero-venue-link hide-sm" href="#venues">{COPY.hero.venue} →</a>
        </div>
        <div className="hide-sm">
          <HeroSearch />
        </div>
      </div>
      <div className="scroll-cue" aria-hidden="true">
        Scroll to play
        <span className="bar" />
      </div>
    </div>
  );
}

function ChapterPanel({ id, card, right }: { id: "book" | "play" | "replay"; card: ReactNode; right?: boolean }) {
  const c = COPY.chapters[id];
  const { open } = useBooking();
  return (
    <div data-panel={id} className={`scene-panel ${right ? "align-right" : ""}`}>
      <div className="inner">
        {right && <div className="hide-sm" style={{ gridColumn: 1, gridRow: 1, justifySelf: "start" }}>{card}</div>}
        <div className="copy" style={right ? { gridColumn: 2, gridRow: 1 } : undefined}>
          <p className="eyebrow" style={{ color: "var(--lime)" }}>{c.kicker}</p>
          <h2>{c.heading}</h2>
          <p className="lede">{c.body}</p>
          {id === "book" && (
            <button type="button" className="btn btn-sm" style={{ marginTop: 20 }} onClick={() => open()}>Book a slot</button>
          )}
          {id === "replay" && (
            <a className="btn btn-sm btn-ghost" style={{ marginTop: 20 }} href="#highlights">See the highlights library</a>
          )}
        </div>
        {!right && <div className="info-card-wrap hide-sm" style={{ justifySelf: "end" }}>{card}</div>}
      </div>
    </div>
  );
}

function StaticJourney({ webglFailed }: { webglFailed: boolean }) {
  const { open } = useBooking();
  const chapters = [
    { id: "book" as const, art: "basketball" as const, card: <BookCard /> },
    { id: "play" as const, art: "volleyball" as const, card: <PlayCard /> },
    { id: "replay" as const, art: "badminton" as const, card: <ReplayCard /> },
  ];
  return (
    <div className="stage">
      <section className="static-hero">
        <div className="container grid">
          <div>
            <p className="eyebrow" style={{ color: "var(--lime)" }}>{COPY.hero.eyebrow}</p>
            <h1>
              Your next game <em>starts here.</em>
            </h1>
            <p className="lede" style={{ color: "var(--muted-dark)", fontSize: "1.1rem", maxWidth: "50ch" }}>{COPY.hero.body}</p>
            <div className="hero-ctas">
              <button type="button" className="btn" onClick={() => open()}>{COPY.hero.primary}</button>
              <a className="btn btn-ghost" href="#how">{COPY.hero.secondary}</a>
            </div>
            <a className="hero-venue-link" href="#venues">{COPY.hero.venue} →</a>
            {webglFailed && <p className="static-notice">The 3D view isn&apos;t available on this device — everything else works the same.</p>}
          </div>
          <HeroSearch />
        </div>
      </section>
      <div id="how" />
      {chapters.map((ch) => {
        const c = COPY.chapters[ch.id];
        return (
          <section key={ch.id} className="static-chapter" aria-labelledby={`st-${ch.id}`}>
            <div className="container grid">
              <div>
                <p className="eyebrow" style={{ color: "var(--lime)" }}>{c.kicker}</p>
                <h2 id={`st-${ch.id}`}>{c.heading}</h2>
                <p className="lede">{c.body}</p>
                <div style={{ marginTop: 20 }}>{ch.card}</div>
              </div>
              <div className="static-art" style={{ aspectRatio: "4 / 3" }}>
                <SportArt sport={ch.art} idSuffix="-static" />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FinalCTA({ finalRef, staticMode }: { finalRef?: React.RefObject<HTMLElement | null>; staticMode?: boolean }) {
  const { open } = useBooking();
  return (
    <section ref={finalRef} id="final" className={`final stage ${staticMode ? "is-static" : ""}`} aria-labelledby="final-title">
      <div className="final-sticky">
        <div className="final-copy">
          {staticMode && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 28, color: "var(--day)" }}>
              <Wordmark height={56} />
            </div>
          )}
          <h2 id="final-title">{COPY.final.heading}</h2>
          <div className="ctas">
            <button type="button" className="btn" onClick={() => open()}>{COPY.final.primary}</button>
            <a className="btn btn-ghost" href="/demo?role=venue">{COPY.final.secondary}</a>
          </div>
          <p className="hint" style={{ marginTop: 18 }}>{COPY.brandLine}</p>
        </div>
      </div>
    </section>
  );
}
