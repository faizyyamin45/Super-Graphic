import React, { useEffect, useRef, useState } from "react";
import {
  motion, useScroll, useSpring, useTransform, useInView,
  useMotionValue, useMotionTemplate, useReducedMotion, animate,
} from "framer-motion";

/* ============================================================
   Motion primitives for Super Graphic.
   The brand is signage — light, neon, illumination — so the
   vocabulary here is "switching on" rather than generic fades.

   Every primitive checks useReducedMotion() and degrades to a
   static, fully-visible render. Nothing animates layout-affecting
   properties, so none of this costs CLS.
   ============================================================ */

/* ---------- scroll progress rail ---------- */
export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const reduce = useReducedMotion();
  const width = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 });
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX: width }}
      className="fixed top-0 inset-x-0 z-[55] h-[3px] origin-left bg-gradient-to-r from-weld via-sodium to-weld"
    />
  );
};

/* ---------- count-up statistic ---------- */
/**
 * Animates the numeric part of a stat into view: "650+" counts to 650 and
 * keeps the plus. Values with more than one number ("24/7") are left alone
 * rather than animated into nonsense.
 */
export const CountUp = ({ value, className = "" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);

  const animatable = (String(value).match(/\d+/g) || []).length === 1;

  useEffect(() => {
    if (!animatable || reduce || !inView) return;
    const digits = (String(value).match(/\d+/g) || [])[0];
    const target = Number(digits);
    const [prefix, suffix] = String(value).split(digits);
    const controls = animate(0, target, {
      duration: Math.min(1.6, 0.5 + target / 700),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(`${prefix}${Math.round(v)}${suffix}`),
      onComplete: () => setShown(value),
    });
    return () => controls.stop();
  }, [animatable, reduce, inView, value]);

  return <span ref={ref} className={className}>{animatable && !reduce ? shown : value}</span>;
};

/* ---------- staggered group ---------- */
export const Stagger = ({ children, className = "", delay = 0, gap = 0.08, as = "div" }) => {
  const reduce = useReducedMotion();
  const Tag = motion[as] ?? motion.div;
  return (
    <Tag
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "shown"}
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </Tag>
  );
};

export const StaggerItem = ({ children, className = "", y = 22, as = "div" }) => {
  const reduce = useReducedMotion();
  const Tag = motion[as] ?? motion.div;
  const Plain = as;
  if (reduce) return <Plain className={className}>{children}</Plain>;
  return (
    <Tag
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </Tag>
  );
};

/* ---------- neon switch-on ---------- */
/**
 * A sign coming to life: a couple of stutters, then steady. Used once, on the
 * hero, where it reads as intentional rather than as a broken animation.
 */
export const NeonOn = ({ children, className = "", delay = 0.35 }) => {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{children}</span>;
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0.12 }}
      animate={{ opacity: [0.12, 1, 0.25, 1, 0.5, 1] }}
      transition={{ duration: 1.1, delay, times: [0, 0.25, 0.35, 0.55, 0.68, 1], ease: "easeOut" }}
    >
      {children}
    </motion.span>
  );
};

/* ---------- cursor spotlight ---------- */
/**
 * A light source tracking the pointer across a dark section — the way a
 * torch reads across an unlit sign. Pointer-only; never shown on touch.
 */
export const Spotlight = ({ children, className = "", size = 420, tint = "198,243,59" }) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [reduce]);

  const background = useMotionTemplate`radial-gradient(${size}px circle at ${x}px ${y}px, rgba(${tint},0.13), transparent 70%)`;

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    x.set(e.clientX - r.left);
    y.set(e.clientY - r.top);
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      onPointerMove={enabled ? onMove : undefined}
      onPointerLeave={enabled ? () => { x.set(-9999); y.set(-9999); } : undefined}
    >
      {enabled && <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ background }} />}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

/* ---------- scroll parallax ---------- */
export const Parallax = ({ children, className = "", distance = 60 }) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yRaw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(yRaw, { stiffness: 120, damping: 26, restDelta: 0.5 });

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
};

/* ---------- magnetic button ---------- */
/**
 * The control leans toward the cursor by a few pixels. Wraps rather than
 * replaces the child, so the underlying Link/button keeps its own semantics.
 */
export const Magnetic = ({ children, className = "", strength = 0.28 }) => {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 260, damping: 18 });
  const y = useSpring(0, { stiffness: 260, damping: 18 });

  if (reduce) return <span className={className}>{children}</span>;

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };

  return (
    <motion.span
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
};

/* ---------- route transition ---------- */
export const PageFade = ({ children }) => {
  const reduce = useReducedMotion();
  if (reduce) return children;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};
