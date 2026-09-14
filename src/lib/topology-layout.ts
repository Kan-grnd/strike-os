/**
 * Force layout for topology using d3-force.
 * Positions nodes in a stable, visible graph.
 */

import * as d3 from "d3-force";
import { TopologyNode } from "./topology-transform";

export function applyForceLayout(nodes: TopologyNode[], width = 1200, height = 800): TopologyNode[] {
  // Create d3 simulation
  const simulation = d3.forceSimulation(nodes as any)
    .force("link", d3.forceLink([]).id((d: any) => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(40).iterations(2))
    .force("x", d3.forceX(width / 2).strength(0.05))
    .force("y", d3.forceY(height / 2).strength(0.05))
    .stop();

  // Run simulation for 300 ticks (~animation frames) then stop
  for (let i = 0; i < 300 && simulation.alpha() > 0.01; i++) {
    simulation.tick();
  }

  return nodes.map((n) => ({
    ...n,
    position: { x: (n as any).x || 0, y: (n as any).y || 0 },
  }));
}
