"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface SpiderWebNode {
  label: string;
  year: number;
  /** Magnitude 0..1 — how far from the center the node sits. */
  value: number;
}

interface SpiderWebProps {
  nodes: SpiderWebNode[];
  onSelect?: (node: SpiderWebNode) => void;
}

const DIM = 520;
const CENTER = DIM / 2;
const MAX_RADIUS = DIM / 2 - 40;

/** D3.js radial timeline — a spider web of eras and events. */
export default function SpiderWeb({ nodes, onSelect }: SpiderWebProps) {
  const ref = useRef<SVGSVGElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    if (nodes.length === 0) {
      svg
        .append("text")
        .attr("x", CENTER)
        .attr("y", CENTER)
        .attr("text-anchor", "middle")
        .attr("fill", "#f4f4f8")
        .attr("opacity", 0.4)
        .text("No timeline data yet");
      return;
    }

    const years = nodes.map((n) => n.year);
    const minYear = d3.min(years) ?? 2000;
    const maxYear = d3.max(years) ?? 2026;

    const angle = d3
      .scaleLinear()
      .domain([minYear, maxYear])
      .range([-Math.PI / 2, (3 * Math.PI) / 2]);

    const radius = d3
      .scaleLinear()
      .domain([0, 1])
      .range([24, MAX_RADIUS]);

    const g = svg.append("g").attr("transform", `translate(${CENTER},${CENTER})`);

    // Concentric rings (era boundaries)
    const rings = g.append("g").attr("class", "rings");
    [0.25, 0.5, 0.75, 1].forEach((r) => {
      rings
        .append("circle")
        .attr("r", radius(r))
        .attr("fill", "none")
        .attr("stroke", "#00d1ff")
        .attr("stroke-opacity", 0.15)
        .attr("stroke-dasharray", "4 6");
    });

    // Radial spokes
    const spokeStep = 12;
    for (let y = Math.ceil(minYear / spokeStep) * spokeStep; y <= maxYear; y += spokeStep) {
      const a = angle(y);
      g.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", Math.cos(a) * MAX_RADIUS)
        .attr("y2", Math.sin(a) * MAX_RADIUS)
        .attr("stroke", "#9d4edd")
        .attr("stroke-opacity", 0.18);
    }

    // Year labels along the outer ring
    const labelYears = d3
      .range(Math.ceil(minYear / 10) * 10, maxYear + 1, 10)
      .filter((y) => y >= minYear);
    g.selectAll(".year-label")
      .data(labelYears)
      .enter()
      .append("text")
      .attr("class", "year-label")
      .attr("x", (y) => Math.cos(angle(y)) * (MAX_RADIUS + 20))
      .attr("y", (y) => Math.sin(angle(y)) * (MAX_RADIUS + 20))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#00d1ff")
      .attr("font-size", 12)
      .text((y) => `${y}s`);

    // Node points
    g.selectAll(".node")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("cx", (n) => Math.cos(angle(n.year)) * radius(n.value))
      .attr("cy", (n) => Math.sin(angle(n.year)) * radius(n.value))
      .attr("r", 6)
      .attr("fill", "#ff2d55")
      .attr("stroke", "#07070f")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .append("title")
      .text((n) => `${n.label} · ${n.year}`);
  }, [nodes]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${DIM} ${DIM}`}
      className="h-full w-full"
      role="img"
      aria-label="Spider web timeline"
    />
  );
}
