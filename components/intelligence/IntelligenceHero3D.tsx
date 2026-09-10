"use client";

import { useEffect, useRef } from "react";
import { canCreateBrowserWebGlContext } from "@/lib/browser/webgl-capability";
import * as THREE from "three";
import styles from "./IntelligenceLuxury.module.css";

type IntelligenceHero3DProps = {
  legend: [string, string, string];
  statusLabel: string;
};

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function IntelligenceHero3D({ legend, statusLabel }: IntelligenceHero3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !canCreateBrowserWebGlContext()) {
      if (host) host.dataset.webgl = "unavailable";
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 8.6);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = styles.heroCanvas;
    host.prepend(renderer.domElement);
    host.dataset.webgl = "true";

    const world = new THREE.Group();
    world.rotation.set(-0.08, 0.38, -0.035);
    scene.add(world);

    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [];
    const addGeometry = <T extends THREE.BufferGeometry>(geometry: T) => {
      disposableGeometries.push(geometry);
      return geometry;
    };
    const addMaterial = <T extends THREE.Material>(material: T) => {
      disposableMaterials.push(material);
      return material;
    };

    const gold = 0xd4b363;
    const teal = 0x49d4c2;
    const panelGeometry = addGeometry(new THREE.BoxGeometry(2.34, 3.18, 0.035));
    const panelEdges = addGeometry(new THREE.EdgesGeometry(panelGeometry));
    const layers: Array<{ group: THREE.Group; baseZ: number }> = [];

    for (let index = 0; index < 6; index += 1) {
      const layer = new THREE.Group();
      const baseZ = (index - 2.5) * 0.35;
      layer.position.set((index - 2.5) * 0.035, (2.5 - index) * 0.018, baseZ);

      const fill = addMaterial(new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0x17302e : 0x2a2415,
        transparent: true,
        opacity: 0.035 + index * 0.006,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }));
      layer.add(new THREE.Mesh(panelGeometry, fill));

      const edge = addMaterial(new THREE.LineBasicMaterial({
        color: index % 2 === 0 ? teal : gold,
        transparent: true,
        opacity: 0.12 + index * 0.014,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      layer.add(new THREE.LineSegments(panelEdges, edge));
      world.add(layer);
      layers.push({ group: layer, baseZ });
    }

    const outerGeometry = addGeometry(new THREE.BoxGeometry(2.9, 3.8, 0.11));
    const outerEdges = addGeometry(new THREE.EdgesGeometry(outerGeometry));
    const outerMaterial = addMaterial(new THREE.LineBasicMaterial({
      color: 0xbda259,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const outerFrame = new THREE.LineSegments(outerEdges, outerMaterial);
    outerFrame.position.z = -0.96;
    world.add(outerFrame);

    const prismGeometry = addGeometry(new THREE.BoxGeometry(0.66, 2.22, 0.58));
    const prismFill = addMaterial(new THREE.MeshBasicMaterial({
      color: teal,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const prism = new THREE.Mesh(prismGeometry, prismFill);
    prism.position.z = 0.24;
    world.add(prism);

    const prismEdgesGeometry = addGeometry(new THREE.EdgesGeometry(prismGeometry));
    const prismEdgesMaterial = addMaterial(new THREE.LineBasicMaterial({
      color: gold,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const prismEdges = new THREE.LineSegments(prismEdgesGeometry, prismEdgesMaterial);
    prismEdges.position.copy(prism.position);
    world.add(prismEdges);

    const random = seededRandom(7309);
    const pointPositions: number[] = [];
    for (let index = 0; index < 390; index += 1) {
      const layer = Math.floor(random() * 6);
      const x = (random() - 0.5) * 2.17;
      const y = (random() - 0.5) * 3;
      const z = (layer - 2.5) * 0.35 + (random() - 0.5) * 0.018;
      pointPositions.push(x, y, z);
    }
    const pointGeometry = addGeometry(new THREE.BufferGeometry());
    pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    const pointMaterial = addMaterial(new THREE.PointsMaterial({
      color: 0xd9c381,
      size: 0.019,
      transparent: true,
      opacity: 0.72,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    world.add(new THREE.Points(pointGeometry, pointMaterial));

    const trackPositions: number[] = [];
    for (let layer = 0; layer < 4; layer += 1) {
      const z = (layer - 1.5) * 0.5;
      for (let row = 0; row < 7; row += 1) {
        const y = -1.32 + row * 0.44;
        trackPositions.push(-1.08, y, z, 1.08, y, z);
      }
      for (let column = 0; column < 5; column += 1) {
        const x = -0.9 + column * 0.45;
        trackPositions.push(x, -1.48, z, x, 1.48, z);
      }
    }
    const trackGeometry = addGeometry(new THREE.BufferGeometry());
    trackGeometry.setAttribute("position", new THREE.Float32BufferAttribute(trackPositions, 3));
    const trackMaterial = addMaterial(new THREE.LineBasicMaterial({
      color: teal,
      transparent: true,
      opacity: 0.085,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    world.add(new THREE.LineSegments(trackGeometry, trackMaterial));

    const nodeGeometry = addGeometry(new THREE.BoxGeometry(0.045, 0.045, 0.045));
    const nodeGoldMaterial = addMaterial(new THREE.MeshBasicMaterial({
      color: gold,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const nodeTealMaterial = addMaterial(new THREE.MeshBasicMaterial({
      color: teal,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const nodes: THREE.Mesh[] = [];
    for (let index = 0; index < 26; index += 1) {
      const node = new THREE.Mesh(nodeGeometry, index % 3 === 0 ? nodeTealMaterial : nodeGoldMaterial);
      node.position.set(
        -0.9 + Math.floor(random() * 5) * 0.45,
        -1.32 + Math.floor(random() * 7) * 0.44,
        -0.76 + Math.floor(random() * 4) * 0.5,
      );
      node.scale.setScalar(index % 6 === 0 ? 1.75 : 1);
      world.add(node);
      nodes.push(node);
    }

    const scanGeometry = addGeometry(new THREE.BoxGeometry(2.5, 0.035, 1.92));
    const scanMaterial = addMaterial(new THREE.MeshBasicMaterial({
      color: teal,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const scan = new THREE.Mesh(scanGeometry, scanMaterial);
    world.add(scan);

    const ambientPositions: number[] = [];
    for (let index = 0; index < 130; index += 1) {
      ambientPositions.push(
        (random() - 0.5) * 6.7,
        (random() - 0.5) * 5.1,
        -1.5 + random() * 1.2,
      );
    }
    const ambientGeometry = addGeometry(new THREE.BufferGeometry());
    ambientGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ambientPositions, 3));
    const ambientMaterial = addMaterial(new THREE.PointsMaterial({
      color: 0xbda259,
      size: 0.017,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    scene.add(new THREE.Points(ambientGeometry, ambientMaterial));

    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let visible = true;
    let animationFrame = 0;
    const animationStartedAt = window.performance.now();

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (reducedMotion) renderer.render(scene, camera);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      targetPointerX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 0.18;
      targetPointerY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 0.12;
    };

    const onPointerLeave = () => {
      targetPointerX = 0;
      targetPointerY = 0;
    };

    const render = () => {
      if (!visible) return;
      const elapsed = (window.performance.now() - animationStartedAt) / 1000;
      pointerX += (targetPointerX - pointerX) * 0.035;
      pointerY += (targetPointerY - pointerY) * 0.035;
      world.rotation.y = 0.38 + Math.sin(elapsed * 0.18) * 0.035 + pointerX;
      world.rotation.x = -0.08 + Math.sin(elapsed * 0.15) * 0.02 + pointerY;
      layers.forEach(({ group, baseZ }, index) => {
        group.position.z = baseZ + Math.sin(elapsed * 0.33 + index * 0.7) * 0.025;
        group.rotation.z = Math.sin(elapsed * 0.16 + index) * 0.0025;
      });
      prism.rotation.y = Math.sin(elapsed * 0.27) * 0.17;
      prismEdges.rotation.copy(prism.rotation);
      scan.position.y = Math.sin(elapsed * 0.43) * 1.42;
      scanMaterial.opacity = 0.045 + (Math.sin(elapsed * 0.86) + 1) * 0.018;
      nodes.forEach((node, index) => {
        const pulse = 0.82 + Math.max(0, Math.sin(elapsed * 0.72 - index * 0.31)) * 0.38;
        node.scale.setScalar((index % 6 === 0 ? 1.55 : 1) * pulse);
      });
      camera.position.x += ((pointerX * 0.5) - camera.position.x) * 0.022;
      camera.position.y += ((-pointerY * 0.45) - camera.position.y) * 0.022;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reducedMotion) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(render);
      } else {
        window.cancelAnimationFrame(animationFrame);
      }
    }, { rootMargin: "120px" });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    visibilityObserver.observe(host);
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave, { passive: true });
    resize();
    if (reducedMotion) renderer.render(scene, camera);
    else animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      disposableGeometries.forEach((geometry) => geometry.dispose());
      disposableMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.webgl;
    };
  }, []);

  return (
    <div ref={hostRef} className={styles.heroWorld} role="img" aria-label={legend.join(" · ")}>
      <div className={styles.heroFallbackPrism} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.heroMatrix} aria-hidden="true"><i /><i /><i /></div>
      <span className={styles.heroDataLabel} data-label="market">MARKET DATA</span>
      <span className={styles.heroDataLabel} data-label="liquidity">LIQUIDITY</span>
      <span className={styles.heroDataLabel} data-label="contract">CONTRACT</span>
      <span className={styles.heroDataLabel} data-label="evidence">EVIDENCE</span>
      <div className={styles.heroWorldStatus} aria-hidden="true"><i /><span>{statusLabel}</span></div>
      <div className={styles.heroWorldLegend} aria-hidden="true">
        {legend.map((item, index) => <span key={item}><small>0{index + 1}</small>{item}</span>)}
      </div>
      <div className={styles.heroObjectIndex} aria-hidden="true"><span>EVIDENCE MONOLITH</span><b>01</b></div>
    </div>
  );
}
