"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface DataPoint {
  era: number;
  category: string;
  title: string;
  price: number;
  availability: string;
}

interface SpiderWebProps {
  data: DataPoint[];
  width?: number;
  height?: number;
}

/** D3 radial timeline — time rings × category strands, with tooltip nodes. */
export default function SpiderWeb({
  data,
  width = 800,
  height = 800,
}: SpiderWebProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !data || data.length === 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const radius = Math.min(width, height) / 2 - 50;
    const centerX = width / 2;
    const centerY = height / 2;

    const categories = Array.from(new Set(data.map((d) => d.category)));
    const years = Array.from(new Set(data.map((d) => d.era))).sort(
      (a, b) => a - b,
    );

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const timeScale = d3
      .scaleLinear()
      // Guard against a degenerate single-year domain (scaleLinear NaN).
      .domain(maxYear > minYear ? [minYear, maxYear] : [minYear, minYear + 1])
      .range([0, radius]);

    // Evenly-spaced angles. Index-based (not d3.scalePoint over [0, 2π]),
    // which would collapse the first and last categories onto the same ray.
    const angleFor = (category: string) => {
      const i = categories.indexOf(category);
      return (i / categories.length) * 2 * Math.PI;
    };

    const pointFor = (d: DataPoint) => {
      const a = angleFor(d.category);
      const r = timeScale(d.era);
      return { x: centerX + Math.cos(a) * r, y: centerY + Math.sin(a) * r };
    };

    // Keep tiny/zero prices visible (spec's `Math.sqrt(price)/2` → 0 for free items).
    const nodeRadius = (d: DataPoint) =>
      Math.max(2, Math.sqrt(Math.max(0, d.price)) / 2);

    // Concentric time rings.
    svg
      .selectAll(".time-ring")
      .data(years)
      .enter()
      .append("circle")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", (d) => timeScale(d))
      .attr("fill", "none")
      .attr("stroke", "#e94560")
      .attr("stroke-width", 1)
      .attr("opacity", 0.3);

    // Year labels.
    svg
      .selectAll(".year-label")
      .data(years)
      .enter()
      .append("text")
      .attr("x", centerX)
      .attr("y", (d) => centerY - timeScale(d) - 5)
      .attr("text-anchor", "middle")
      .attr("fill", "#eaeaea")
      .attr("font-size", "12px")
      .text((d) => d);

    // Radial category strands.
    svg
      .selectAll(".category-strand")
      .data(categories)
      .enter()
      .append("line")
      .attr("x1", centerX)
      .attr("y1", centerY)
      .attr("x2", (d) => centerX + Math.cos(angleFor(d)) * radius)
      .attr("y2", (d) => centerY + Math.sin(angleFor(d)) * radius)
      .attr("stroke", "#0f3460")
      .attr("stroke-width", 2);

    // Category labels.
    svg
      .selectAll(".category-label")
      .data(categories)
      .enter()
      .append("text")
      .attr("x", (d) => centerX + Math.cos(angleFor(d)) * (radius + 20))
      .attr("y", (d) => centerY + Math.sin(angleFor(d)) * (radius + 20))
      .attr("text-anchor", "middle")
      .attr("fill", "#eaeaea")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text((d) => d);

    // Data nodes + tooltips.
    svg
      .selectAll(".data-node")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => pointFor(d).x)
      .attr("cy", (d) => pointFor(d).y)
      .attr("r", nodeRadius)
      .attr("fill", "#e94560")
      .attr("opacity", 0.7)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", nodeRadius(d) * 1.5)
          .attr("opacity", 1);

        const p = pointFor(d);
        const tooltip = svg
          .append("g")
          .attr("class", "tooltip")
          .attr("transform", `translate(${p.x + 10}, ${p.y - 10})`);

        tooltip
          .append("rect")
          .attr("width", 200)
          .attr("height", 80)
          .attr("fill", "#1a1a2e")
          .attr("stroke", "#e94560")
          .attr("stroke-width", 2)
          .attr("rx", 5);

        tooltip
          .append("text")
          .attr("x", 10)
          .attr("y", 20)
          .attr("fill", "#eaeaea")
          .attr("font-size", "12px")
          .text(d.title);

        tooltip
          .append("text")
          .attr("x", 10)
          .attr("y", 40)
          .attr("fill", "#e94560")
          .attr("font-size", "14px")
          .attr("font-weight", "bold")
          .text(`$${d.price}`);

        tooltip
          .append("text")
          .attr("x", 10)
          .attr("y", 60)
          .attr("fill", "#0f3460")
          .attr("font-size", "12px")
          .text(`Year: ${d.era}`);
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", nodeRadius(d))
          .attr("opacity", 0.7);
        svg.selectAll(".tooltip").remove();
      });
  }, [data, width, height]);

  return (
    <div className="spider-web-container h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        style={{ background: "#1a1a2e", borderRadius: "8px" }}
        role="img"
        aria-label="Spider web timeline"
      />
    </div>
  );
}
