"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface PricePoint {
  year: number;
  price: number;
}

interface PriceChartProps {
  data: PricePoint[];
}

const W = 640;
const H = 320;
const MARGIN = { top: 20, right: 30, bottom: 40, left: 60 };

/** D3.js line chart for price history. */
export default function PriceChart({ data }: PriceChartProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    if (data.length === 0) return;

    const x = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.year) as [number, number])
      .range([MARGIN.left, W - MARGIN.right]);

    const y = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (d) => d.price) ?? 0) * 1.1])
      .range([H - MARGIN.bottom, MARGIN.top]);

    const line = d3
      .line<PricePoint>()
      .x((d) => x(d.year))
      .y((d) => y(d.price))
      .curve(d3.curveMonotoneX);

    const g = svg.append("g");

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${H - MARGIN.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));

    g.append("g")
      .attr("transform", `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => `$${v}`));

    // Area fill
    const area = d3
      .area<PricePoint>()
      .x((d) => x(d.year))
      .y0(H - MARGIN.bottom)
      .y1((d) => y(d.price))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(data)
      .attr("fill", "url(#priceGradient)")
      .attr("opacity", 0.35)
      .attr("d", area);

    // Line
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#ff2d55")
      .attr("stroke-width", 2.5)
      .attr("d", line);

    // Dots
    g.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => y(d.price))
      .attr("r", 4)
      .attr("fill", "#00d1ff");

    // Gradient
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "priceGradient")
      .attr("x1", "0")
      .attr("y1", "0")
      .attr("x2", "0")
      .attr("y2", "1");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#ff2d55");
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#ff2d55")
      .attr("stop-opacity", 0);
  }, [data]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Price history chart"
    />
  );
}
