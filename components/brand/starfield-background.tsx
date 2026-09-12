"use client";

import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; size: number; gold: boolean; phase: number };

export function StarfieldBackground({ density = 0.7 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let stars: Star[] = [];
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const maxDepth = 1500;
    let width = 0;
    let height = 0;
    let focal = 600;
    const reset = (star: Star, scatter = false) => {
      const spread = Math.max(width, height, 900);
      star.x = (Math.random() - .5) * spread * 2.2;
      star.y = (Math.random() - .5) * spread * 1.55;
      star.z = scatter ? 50 + Math.random() * maxDepth : maxDepth;
      star.size = .5 + Math.random() * 1.5;
      star.gold = Math.random() > .7;
      star.phase = Math.random() * Math.PI * 2;
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight; focal = Math.min(width, height) * .9;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(760, Math.max(320, (width * height) / 2600)) * density);
      stars = Array.from({ length: count }, () => { const star = { x: 0, y: 0, z: 0, size: 0, gold: false, phase: 0 }; reset(star, true); return star; });
    };
    const draw = (time = 0) => {
      pointer.x += (pointer.targetX - pointer.x) * .025; pointer.y += (pointer.targetY - pointer.y) * .025;
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (!reduceMotion) star.z -= .65;
        const perspective = focal / Math.max(10, star.z);
        const x = width / 2 + pointer.x * 38 + star.x * perspective;
        const y = height / 2 + pointer.y * 28 + star.y * perspective;
        if (star.z < 10 || x < -120 || x > width + 120 || y < -120 || y > height + 120) { reset(star); continue; }
        const closeness = 1 - star.z / maxDepth;
        const alpha = Math.min(.95, .16 + closeness) * (.8 + Math.sin(time * .003 + star.phase) * .18);
        context.beginPath(); context.arc(x, y, Math.max(.45, star.size * (.5 + closeness * 2.7)), 0, Math.PI * 2);
        context.fillStyle = star.gold ? `rgba(212,175,55,${alpha})` : `rgba(255,255,255,${alpha})`;
        context.fill();
      }
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };
    resize();
    if (reduceMotion) draw();
    else frame = requestAnimationFrame(draw);
    const onResize = () => { resize(); if (reduceMotion) draw(); };
    const onPointerMove = (event: PointerEvent) => { pointer.targetX = (event.clientX / Math.max(width, 1) - .5) * 2; pointer.targetY = (event.clientY / Math.max(height, 1) - .5) * 2; };
    window.addEventListener("resize", onResize);
    if (!reduceMotion) window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); window.removeEventListener("pointermove", onPointerMove); };
  }, [density]);

  return <div aria-hidden="true" className="app-background app-background--stars"><canvas ref={canvasRef} /></div>;
}
