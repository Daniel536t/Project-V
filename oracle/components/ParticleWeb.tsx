"use client";

import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/**
 * A subtle particle web behind the SENSE side: ~50 faint electric-blue nodes
 * connected by thin lines, slow rotation, opacity ≤ 0.12. Pure canvas 2D —
 * deliberately lightweight (no three.js) so it never affects readability.
 * When `ripple` is true, one pulse emanates through the web once.
 */
export default function ParticleWeb({ ripple }: { ripple: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rippleRef = useRef(0);

  useEffect(() => {
    if (ripple) rippleRef.current = 1;
  }, [ripple]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let raf = 0;
    const NODE_COUNT = 55;
    const LINK_DIST = 130;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: 0.6 + Math.random() * 1.1,
      }));
    };

    let rot = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // slow global rotation around the center
      const cx = width / 2;
      const cy = height / 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      const linkAlpha = 0.5;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            ctx.strokeStyle = `rgba(0, 212, 255, ${(1 - d / LINK_DIST) * linkAlpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        // apply the slow rotation to each node's position relative to center
        const dx = n.x - cx;
        const dy = n.y - cy;
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;

        ctx.fillStyle = "rgba(0, 212, 255, 0.7)";
        ctx.beginPath();
        ctx.arc(cx + rx, cy + ry, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // heal ripple pulse — one expanding ring
      if (rippleRef.current > 0) {
        const t = 1 - rippleRef.current;
        ctx.strokeStyle = `rgba(0, 212, 255, ${t * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, t * Math.max(width, height) * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        rippleRef.current -= 0.02;
        if (rippleRef.current < 0) rippleRef.current = 0;
      }

      rot += 0.0004;
      raf = requestAnimationFrame(draw);
    };

    resize();
    seed();
    draw();

    window.addEventListener("resize", () => {
      resize();
      seed();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="sense-web" aria-hidden="true" />;
}
