"use client";

import { useEffect, useRef } from "react";
import { canCreateBrowserWebGlContext } from "@/lib/browser/webgl-capability";
import * as THREE from "three";
import { useTranslations } from "next-intl";

type NodePoint = {
  position: THREE.Vector3;
  weight: number;
};

function seeded(index: number) {
  const x = Math.sin(index * 999.91) * 10000;
  return x - Math.floor(x);
}

function createNodes(count: number) {
  const nodes: NodePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / count;
    const radius = 1.35 + seeded(index + 11) * 2.15;
    const theta = t * Math.PI * 2.399963 + seeded(index + 4) * 0.34;
    const y = (seeded(index + 17) - 0.5) * 3.8;
    const z = Math.cos(theta) * radius * (0.64 + seeded(index + 23) * 0.4);
    const x = Math.sin(theta) * radius * (1.15 + seeded(index + 31) * 0.36);
    nodes.push({
      position: new THREE.Vector3(x, y, z),
      weight: seeded(index + 41),
    });
  }
  return nodes;
}

function createEdges(nodes: NodePoint[], maxEdges: number) {
  const edges: Array<[number, number]> = [];
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      const distance = nodes[a].position.distanceTo(nodes[b].position);
      if (distance < 1.42 && edges.length < maxEdges) {
        edges.push([a, b]);
      }
    }
  }
  return edges;
}

export default function NeuralAtelier3D() {
  const t = useTranslations("Home");
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPowerMode = Boolean(
      reducedMotion ||
      window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ||
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    );
    if (lowPowerMode || !canCreateBrowserWebGlContext()) return undefined;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030303, 0.075);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 0.2, 8.2);

    const group = new THREE.Group();
    scene.add(group);

    const size = host.getBoundingClientRect();
    const nodeCount = size.width < 520 ? 34 : 68;
    const nodes = createNodes(nodeCount);
    const edges = createEdges(nodes, size.width < 520 ? 54 : 120);

    const nodePositions = new Float32Array(nodes.length * 3);
    nodes.forEach((node, index) => {
      nodePositions[index * 3] = node.position.x;
      nodePositions[index * 3 + 1] = node.position.y;
      nodePositions[index * 3 + 2] = node.position.z;
    });

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
    const points = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({
        color: 0xf5f0e8,
        size: 0.052,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
      }),
    );
    group.add(points);

    const linePositions = new Float32Array(edges.length * 6);
    edges.forEach(([start, end], index) => {
      const a = nodes[start].position;
      const b = nodes[end].position;
      linePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], index * 6);
    });
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: 0xd8d5cf,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    group.add(lines);

    const goldGeometry = new THREE.BufferGeometry();
    const goldNodes = nodes.filter((node) => node.weight > 0.86).slice(0, 9);
    const goldPositions = new Float32Array(goldNodes.length * 3);
    goldNodes.forEach((node, index) => {
      goldPositions.set([node.position.x, node.position.y, node.position.z], index * 3);
    });
    goldGeometry.setAttribute("position", new THREE.BufferAttribute(goldPositions, 3));
    const goldPoints = new THREE.Points(
      goldGeometry,
      new THREE.PointsMaterial({
        color: 0xc8a96a,
        size: 0.09,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    );
    group.add(goldPoints);

    const signal = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xc8a96a, transparent: true, opacity: 0.95 }),
    );
    group.add(signal);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xc8a96a, transparent: true, opacity: 0.11, depthWrite: false }),
    );
    signal.add(halo);

    let width = 0;
    let height = 0;
    let frameId = 0;
    let visible = true;
    let tabVisible = !document.hidden;
    const clock = new THREE.Clock();

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const renderFrame = () => {
      frameId = 0;
      const elapsed = clock.getElapsedTime();
      group.rotation.y = elapsed * 0.08;
      group.rotation.x = Math.sin(elapsed * 0.18) * 0.08;
      group.rotation.z = Math.sin(elapsed * 0.11) * 0.035;

      if (edges.length) {
        const edgeIndex = Math.floor(elapsed * 0.46) % edges.length;
        const [start, end] = edges[edgeIndex];
        const a = nodes[start].position;
        const b = nodes[end].position;
        const localT = (elapsed * 0.46) % 1;
        signal.position.lerpVectors(a, b, localT);
      }

      const pulse = 0.72 + Math.sin(elapsed * 2.4) * 0.22;
      (points.material as THREE.PointsMaterial).opacity = 0.68 + pulse * 0.16;
      (goldPoints.material as THREE.PointsMaterial).opacity = 0.72 + pulse * 0.2;
      renderer.render(scene, camera);

      if (visible && tabVisible) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };

    const start = () => {
      if (!frameId && !reducedMotion && visible && tabVisible) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };

    const stop = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const updateRunningState = () => {
      if (visible && tabVisible && !reducedMotion) start();
      else {
        stop();
        renderer.render(scene, camera);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updateRunningState();
    });
    observer.observe(host);

    const onVisibilityChange = () => {
      tabVisible = !document.hidden;
      updateRunningState();
    };

    resize();
    if (reducedMotion) {
      group.rotation.y = -0.22;
      renderer.render(scene, camera);
    } else {
      start();
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      pointGeometry.dispose();
      lineGeometry.dispose();
      goldGeometry.dispose();
      (points.material as THREE.Material).dispose();
      (lines.material as THREE.Material).dispose();
      (goldPoints.material as THREE.Material).dispose();
      signal.geometry.dispose();
      (signal.material as THREE.Material).dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={t("heroImageAlt")}
      className="pointer-events-none relative aspect-square w-full max-h-[560px] touch-pan-y overflow-hidden rounded-3xl border border-white/[0.10] bg-white/[0.04] md:aspect-[4/3]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_54%_42%,rgba(200,169,106,0.18),transparent_34%),linear-gradient(145deg,rgba(245,240,232,0.10),transparent_42%,rgba(0,0,0,0.28))]" />
      <div className="pointer-events-none absolute inset-0 border border-white/[0.04]" />
    </div>
  );
}
