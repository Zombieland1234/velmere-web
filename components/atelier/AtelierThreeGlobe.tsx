"use client";

import { canCreateBrowserWebGlContext } from "@/lib/browser/webgl-capability";

import { useEffect, useRef, useState } from "react";
import type {
  BufferGeometry,
  Material,
  Mesh,
  Object3D,
  PointsMaterial,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";

export type AtelierFacility = {
  id: string;
  city: string;
  region: string;
  title: string;
  note: string;
  lat: number;
  lon: number;
  precision: "exact" | "country" | "routing";
};

export type AtelierGlobeCopy = {
  visualAria: string;
  controlAria: string;
  loading: string;
  fallbackTitle: string;
  fallbackBody: string;
  selectedNode: string;
  dragTap: string;
  dragTapKeyboard: string;
  realCoordinates: string;
  surfaceMode: string;
  surfaceModeShort: string;
  imageryCredit: string;
  nodeTypes: {
    exact: string;
    country: string;
    routing: string;
  };
};

type Props = {
  facilities: AtelierFacility[];
  copy: AtelierGlobeCopy;
};

type GlobeLabel = {
  city: string;
  region: string;
  title: string;
  note: string;
  coordinates: string;
  nodeType: string;
  x: number;
  y: number;
};

type ThreeModule = typeof import("three");
type GlobeMaterial = Material & { dispose?: () => void };
type GlobeRenderableObject = Object3D & {
  geometry?: BufferGeometry & { dispose?: () => void };
  material?: GlobeMaterial | GlobeMaterial[];
};
type GlobeNodeUserData = {
  facility?: AtelierFacility;
  domLabel?: HTMLDivElement;
  domLabelSide?: number;
};
type GlobeNodeObject = Object3D & { userData: GlobeNodeUserData };
type GlobeRayHit = { object: GlobeNodeObject };
type RouteTraveller = { mesh: Mesh; points: Vector3[]; speed: number; offset: number };

const EARTH_TEXTURES = {
  day: "/images/atelier/earth-blue-marble-2048.jpg",
  dayHd: "/images/atelier/earth-blue-marble-5400.jpg",
  night: "/images/atelier/earth-night-lights-2048.jpg",
  nightHd: "/images/atelier/earth-night-lights-3600.jpg",
  normal: "/images/atelier/earth-normal-2048.jpg",
  specular: "/images/atelier/earth-specular-2048.jpg",
  clouds: "/images/atelier/earth-clouds-1024.png",
} as const;

const GOLD = 0xd6b77a;
const NODE_GOLD = 0xffe6ad;
const LABELLED_NODE_IDS = new Set<string>([
  "us-los-angeles",
  "eu-barcelona",
  "eu-riga",
  "asia-china",
  "br-network",
  "au-network",
]);
const POSTER_LABELLED_NODE_IDS = new Set<string>(["eu-barcelona", "asia-china", "br-network"]);

function formatAtelierLabel(city: string) {
  if (city.includes(" / ")) return city.split(" / ")[0];
  if (city.includes(",")) return city.split(",")[0];
  return city.replace(" partner facility", "").replace(" routing facility", "");
}

function formatAtelierType(facility: AtelierFacility, copy: AtelierGlobeCopy) {
  if (facility.precision === "exact") return copy.nodeTypes.exact;
  if (facility.precision === "country") return copy.nodeTypes.country;
  return copy.nodeTypes.routing;
}

function formatAtelierCoordinates(lat: number, lon: number) {
  const latitude = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
  return `${latitude} · ${longitude}`;
}

function projectPosterPoint(lat: number, lon: number) {
  const centerLat = 13 * (Math.PI / 180);
  const centerLon = 19 * (Math.PI / 180);
  const latitude = lat * (Math.PI / 180);
  const longitude = lon * (Math.PI / 180);
  const deltaLongitude = longitude - centerLon;
  const visibility =
    Math.sin(centerLat) * Math.sin(latitude) +
    Math.cos(centerLat) * Math.cos(latitude) * Math.cos(deltaLongitude);

  return {
    visible: visibility > 0.025,
    x: 50 + 46 * Math.cos(latitude) * Math.sin(deltaLongitude),
    y:
      50 -
      46 *
        (Math.cos(centerLat) * Math.sin(latitude) -
          Math.sin(centerLat) * Math.cos(latitude) * Math.cos(deltaLongitude)),
  };
}

function AtelierSatellitePoster({ facilities }: { facilities: AtelierFacility[] }) {
  const points = facilities.map((facility) => ({ facility, ...projectPosterPoint(facility.lat, facility.lon) }));
  const visiblePoints = points.filter((point) => point.visible);
  const hub = visiblePoints.find((point) => point.facility.id === "eu-barcelona") ?? visiblePoints[0];
  const routes = hub
    ? visiblePoints
        .filter((point) => point.facility.id !== hub.facility.id)
        .filter((point) => ["eu-riga", "asia-china", "br-network"].includes(point.facility.id))
        .map((point, index) => {
          const middleX = (hub.x + point.x) / 2;
          const middleY = (hub.y + point.y) / 2 - Math.max(3.8, Math.abs(point.x - hub.x) * 0.13);
          return {
            id: `${hub.facility.id}-${point.facility.id}`,
            d: `M ${hub.x.toFixed(2)} ${hub.y.toFixed(2)} Q ${middleX.toFixed(2)} ${middleY.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
            duration: 5.4 + index * 1.25,
          };
        })
    : [];

  return (
    <div className="atelier-globe-poster" aria-hidden="true">
      <div className="atelier-real-globe__halo" />
      <div className="atelier-real-globe__orbit atelier-real-globe__orbit--one" />
      <div className="atelier-real-globe__orbit atelier-real-globe__orbit--two" />
      <div className="atelier-real-globe__sphere">
        <div className="atelier-real-globe__surface" />
        <div className="atelier-real-globe__night" />
        <div className="atelier-real-globe__clouds atelier-real-globe__clouds--low" />
        <div className="atelier-real-globe__clouds atelier-real-globe__clouds--high" />
        <div className="atelier-real-globe__shade" />
        <div className="atelier-real-globe__atmosphere" />
        <svg className="atelier-real-globe__network" viewBox="0 0 100 100" preserveAspectRatio="none">
          {routes.map((route) => (
            <g key={route.id}>
              <path d={route.d} className="atelier-real-globe__route" pathLength="1" />
              <circle r="0.38" className="atelier-real-globe__traveller">
                <animateMotion dur={`${route.duration}s`} repeatCount="indefinite" path={route.d} />
              </circle>
            </g>
          ))}
          {visiblePoints.map((point) => (
            <g key={point.facility.id} transform={`translate(${point.x} ${point.y})`}>
              <circle r="1.2" className="atelier-real-globe__node-halo" />
              <circle r="0.4" className="atelier-real-globe__node" />
            </g>
          ))}
        </svg>
      </div>
      {visiblePoints
        .filter((point) => POSTER_LABELLED_NODE_IDS.has(point.facility.id))
        .map((point) => (
          <span
            key={point.facility.id}
            className="atelier-real-globe__label"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            {formatAtelierLabel(point.facility.city)}
          </span>
        ))}
    </div>
  );
}

/**
 * Matches Three.js SphereGeometry UVs exactly:
 * u=0.5 is Greenwich, east longitudes rotate toward -Z.
 */
function latLonToVector(THREE: ThreeModule, lat: number, lon: number, radius: number): Vector3 {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lon);
  const cosLatitude = Math.cos(latitude);

  return new THREE.Vector3(
    radius * cosLatitude * Math.cos(longitude),
    radius * Math.sin(latitude),
    -radius * cosLatitude * Math.sin(longitude),
  );
}

function makeRadialTexture(THREE: ThreeModule, size = 160) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,252,236,1)");
  gradient.addColorStop(0.12, "rgba(255,226,166,.98)");
  gradient.addColorStop(0.34, "rgba(214,183,122,.38)");
  gradient.addColorStop(1, "rgba(214,183,122,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createStarField(THREE: ThreeModule, count: number, spread: number, size: number, opacity: number) {
  let seed = 0x2f6e2b1;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let index = 0; index < count; index += 1) {
    positions.push(
      (random() - 0.5) * spread,
      (random() - 0.5) * spread * 0.56,
      -4 - random() * 18,
    );
    color.setRGB(0.62 + random() * 0.28, 0.68 + random() * 0.24, 0.78 + random() * 0.22);
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function createGreatCirclePoints(
  THREE: ThreeModule,
  from: AtelierFacility,
  to: AtelierFacility,
  radius: number,
) {
  const start = latLonToVector(THREE, from.lat, from.lon, 1).normalize();
  const end = latLonToVector(THREE, to.lat, to.lon, 1).normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(start.dot(end), -1, 1));
  const sinAngle = Math.sin(angle);
  const points: Vector3[] = [];

  for (let index = 0; index <= 96; index += 1) {
    const t = index / 96;
    let vector: Vector3;
    if (sinAngle < 0.0001) {
      vector = start.clone().lerp(end, t).normalize();
    } else {
      const fromWeight = Math.sin((1 - t) * angle) / sinAngle;
      const toWeight = Math.sin(t * angle) / sinAngle;
      vector = start.clone().multiplyScalar(fromWeight).add(end.clone().multiplyScalar(toWeight)).normalize();
    }
    vector.multiplyScalar(radius + Math.sin(Math.PI * t) * 0.13);
    points.push(vector);
  }
  return points;
}

function createNightMaterial(THREE: ThreeModule, texture: Texture, sunDirection: Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      nightTexture: { value: texture },
      sunDirection: { value: sunDirection },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D nightTexture;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vec3 night = texture2D(nightTexture, vUv).rgb;
        float darkness = 1.0 - smoothstep(-0.10, 0.28, dot(normalize(vWorldNormal), sunDirection));
        float lightEnergy = max(max(night.r, night.g), night.b);
        vec3 warmNight = night * vec3(1.24, 1.10, 0.90);
        float alpha = darkness * smoothstep(0.015, 0.48, lightEnergy) * 0.94;
        gl_FragColor = vec4(warmNight * (0.8 + lightEnergy * 1.9), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createAtmosphereMaterial(THREE: ThreeModule, sunDirection: Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      sunDirection: { value: sunDirection },
      blueGlow: { value: new THREE.Color(0x4d9fff) },
      goldGlow: { value: new THREE.Color(0xd6b77a) },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 sunDirection;
      uniform vec3 blueGlow;
      uniform vec3 goldGlow;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDirection), 0.0), 3.05);
        float sunlight = smoothstep(-0.15, 0.55, dot(normalize(vWorldNormal), sunDirection));
        vec3 glow = mix(blueGlow, goldGlow, sunlight * 0.32);
        gl_FragColor = vec4(glow, rim * (0.34 + sunlight * 0.17));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

export default function AtelierThreeGlobe({ facilities, copy }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const nodeLabelLayerRef = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState<GlobeLabel | null>(null);
  const [hasGlobeError, setHasGlobeError] = useState(false);
  const [isGlobeReady, setIsGlobeReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    const bootWatchdog = window.setTimeout(() => {
      if (!disposed) setHasGlobeError(true);
    }, 9000);
    setIsGlobeReady(false);
    setHasGlobeError(false);

    async function boot() {
      if (!canCreateBrowserWebGlContext()) {
        setHasGlobeError(true);
        return;
      }
      const THREE = await import("three");
      if (disposed || !mountRef.current) return;
      const mountElement = mountRef.current;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0.02, 9.45);

      const compactRenderer = window.innerWidth < 760;
      let renderer: WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
      } catch {
        setHasGlobeError(true);
        return;
      }

      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactRenderer ? 1.45 : 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "pan-y";
      renderer.domElement.setAttribute("aria-hidden", "true");
      mountElement.appendChild(renderer.domElement);

      const textureLoader = new THREE.TextureLoader();
      const useHighDefinitionSurface = !compactRenderer && renderer.capabilities.maxTextureSize >= 8192;
      let loadedTextures: Texture[] = [];
      try {
        loadedTextures = await Promise.all([
          textureLoader.loadAsync(useHighDefinitionSurface ? EARTH_TEXTURES.dayHd : EARTH_TEXTURES.day),
          textureLoader.loadAsync(useHighDefinitionSurface ? EARTH_TEXTURES.nightHd : EARTH_TEXTURES.night),
          textureLoader.loadAsync(EARTH_TEXTURES.normal),
          textureLoader.loadAsync(EARTH_TEXTURES.specular),
          textureLoader.loadAsync(EARTH_TEXTURES.clouds),
        ]);
      } catch {
        renderer.dispose();
        renderer.domElement.remove();
        if (!disposed) setHasGlobeError(true);
        return;
      }

      if (disposed) {
        loadedTextures.forEach((texture) => texture.dispose());
        renderer.dispose();
        renderer.domElement.remove();
        return;
      }

      const [dayTexture, nightTexture, normalTexture, specularTexture, cloudTexture] = loadedTextures;
      dayTexture.colorSpace = THREE.SRGBColorSpace;
      nightTexture.colorSpace = THREE.SRGBColorSpace;
      cloudTexture.colorSpace = THREE.SRGBColorSpace;
      const anisotropy = Math.min(compactRenderer ? 8 : 16, renderer.capabilities.getMaxAnisotropy());
      loadedTextures.forEach((texture) => {
        texture.anisotropy = anisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
      });

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const showNodeLabels = window.innerWidth >= 1280;
      const radius = 2.72;
      const sphereSegments = window.innerWidth < 700 ? [96, 64] : [160, 112];
      const sunDirection = new THREE.Vector3(3.8, 2.2, 6.5).normalize();

      const starField = createStarField(THREE, window.innerWidth < 700 ? 240 : 620, 30, 0.026, 0.58);
      const farStarField = createStarField(THREE, window.innerWidth < 700 ? 110 : 300, 42, 0.013, 0.42);
      farStarField.position.z = -3;
      scene.add(starField, farStarField);

      const hemisphere = new THREE.HemisphereLight(0x91bcff, 0x020305, 0.5);
      scene.add(hemisphere);
      const sunlight = new THREE.DirectionalLight(0xfff0d2, 3.35);
      sunlight.position.copy(sunDirection).multiplyScalar(10);
      scene.add(sunlight);
      const coolFill = new THREE.DirectionalLight(0x4f78ad, 0.34);
      coolFill.position.set(-6, -1.5, 2.4);
      scene.add(coolFill);

      const root = new THREE.Group();
      root.rotation.set(-0.105, -1.92, -0.018);
      root.position.set(0.2, 0.08, 0);
      root.scale.setScalar(0.92);
      scene.add(root);

      const earthGeometry = new THREE.SphereGeometry(radius, sphereSegments[0], sphereSegments[1]);
      const earthMaterial = new THREE.MeshPhongMaterial({
        map: dayTexture,
        normalMap: normalTexture,
        normalScale: new THREE.Vector2(0.54, 0.54),
        specularMap: specularTexture,
        specular: new THREE.Color(0x416f88),
        shininess: 18,
      });
      const earth = new THREE.Mesh(earthGeometry, earthMaterial);
      earth.renderOrder = 1;
      root.add(earth);

      const night = new THREE.Mesh(
        new THREE.SphereGeometry(radius + 0.006, sphereSegments[0], sphereSegments[1]),
        createNightMaterial(THREE, nightTexture, sunDirection),
      );
      night.renderOrder = 2;
      root.add(night);

      const cloudMaterial = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        alphaMap: cloudTexture,
        color: 0xf3f7ff,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        shininess: 1,
      });
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(radius + 0.035, sphereSegments[0], sphereSegments[1]),
        cloudMaterial,
      );
      clouds.renderOrder = 3;
      root.add(clouds);

      const highCloudMaterial = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        alphaMap: cloudTexture,
        color: 0xdcecff,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        shininess: 0,
      });
      const highClouds = new THREE.Mesh(
        new THREE.SphereGeometry(radius + 0.057, sphereSegments[0], sphereSegments[1]),
        highCloudMaterial,
      );
      highClouds.rotation.set(0.008, -0.022, -0.004);
      highClouds.renderOrder = 3;
      root.add(highClouds);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.045, sphereSegments[0], sphereSegments[1]),
        createAtmosphereMaterial(THREE, sunDirection),
      );
      atmosphere.renderOrder = 4;
      root.add(atmosphere);

      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.16, 0.0045, 10, 320),
        new THREE.MeshBasicMaterial({
          color: GOLD,
          transparent: true,
          opacity: 0.17,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      orbit.rotation.set(1.18, 0.14, -0.38);
      orbit.renderOrder = 5;
      root.add(orbit);

      const routeTravellers: RouteTraveller[] = [];
      const hub = facilities.find((facility) => facility.id === "eu-barcelona") ?? facilities[0];
      if (hub) {
        const routeTargets = facilities
          .filter((facility) => facility.id !== hub.id)
          .filter((facility) => ["us-los-angeles", "asia-china", "br-network", "au-network", "eu-riga"].includes(facility.id));
        routeTargets.forEach((target, routeIndex) => {
          const points = createGreatCirclePoints(THREE, hub, target, radius + 0.045);
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({
              color: routeIndex === 4 ? 0xbfd8ff : GOLD,
              transparent: true,
              opacity: routeIndex === 4 ? 0.15 : 0.24,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          line.renderOrder = 5;
          root.add(line);

          const traveller = new THREE.Mesh(
            new THREE.SphereGeometry(0.017, 12, 8),
            new THREE.MeshBasicMaterial({
              color: NODE_GOLD,
              transparent: true,
              opacity: 0.92,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          traveller.position.copy(points[0]);
          traveller.renderOrder = 7;
          root.add(traveller);
          routeTravellers.push({ mesh: traveller, points, speed: 0.055 + routeIndex * 0.008, offset: routeIndex * 0.17 });
        });
      }

      nodeLabelLayerRef.current?.replaceChildren();
      const glowTexture = makeRadialTexture(THREE);
      const nodeObjects: GlobeNodeObject[] = [];
      const labelledNodeObjects: GlobeNodeObject[] = [];

      for (const facility of facilities) {
        const position = latLonToVector(THREE, facility.lat, facility.lon, radius + 0.065);
        const group = new THREE.Group() as GlobeNodeObject;
        group.position.copy(position);
        group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
        group.userData.facility = facility;

        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0045, 0.0045, 0.068, 8),
          new THREE.MeshBasicMaterial({ color: NODE_GOLD, transparent: true, opacity: 0.72 }),
        );
        stem.rotation.x = Math.PI / 2;
          stem.position.z = -0.024;
        stem.userData.facility = facility;
        group.add(stem);

        if (glowTexture) {
          const glow = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: glowTexture,
              color: NODE_GOLD,
              transparent: true,
              opacity: 0.76,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          glow.scale.set(0.2, 0.2, 0.2);
          glow.userData.facility = facility;
          group.add(glow);
        }

        const coreDot = new THREE.Mesh(
          new THREE.SphereGeometry(0.019, 18, 12),
          new THREE.MeshBasicMaterial({
            color: NODE_GOLD,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        coreDot.userData.facility = facility;
        group.add(coreDot);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.052, 0.0024, 8, 64),
          new THREE.MeshBasicMaterial({
            color: NODE_GOLD,
            transparent: true,
            opacity: 0.62,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        ring.userData.facility = facility;
        group.add(ring);

        if (showNodeLabels && LABELLED_NODE_IDS.has(facility.id)) {
          const labelElement = document.createElement("div");
          labelElement.className =
            "atelier-node-label pointer-events-none absolute hidden min-w-[8.5rem] whitespace-nowrap border-l border-velmere-gold/40 pl-3 font-mono uppercase drop-shadow-[0_12px_30px_rgba(0,0,0,0.75)] xl:block";
          const cityElement = document.createElement("span");
          cityElement.className = "block text-[9px] font-semibold leading-none tracking-[0.22em] text-white/[0.85]";
          cityElement.textContent = formatAtelierLabel(facility.city);
          const typeElement = document.createElement("span");
          typeElement.className = "mt-1.5 block text-[8.5px] leading-none tracking-[0.18em] text-velmere-gold/70";
          typeElement.textContent = formatAtelierType(facility, copy);
          labelElement.append(cityElement, typeElement);
          nodeLabelLayerRef.current?.appendChild(labelElement);
          group.userData.domLabel = labelElement;
          labelledNodeObjects.push(group);
        }

        root.add(group);
        nodeObjects.push(group);
      }

      let width = 1;
      let height = 1;
      let animationFrame = 0;
      let isInViewport = true;
      let isTabVisible = document.visibilityState === "visible";
      let dragging = false;
      let hasDragged = false;
      let lastX = 0;
      let lastY = 0;
      let yawVelocity = 0;
      let pitchVelocity = 0;
      let activeId: string | null = null;
      let firstFrameRendered = false;
      let lastFrameTime = performance.now();
      let lastLabelFrameTime = 0;
      let elapsed = 0;

      const resize = () => {
        const rect = mountElement.getBoundingClientRect();
        width = Math.max(300, rect.width);
        height = Math.max(300, rect.height);
        const nextDpr = width < 700 ? 1.45 : width < 1100 ? 1.7 : 2;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, nextDpr));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = width < 640 ? (width / height < 0.92 ? 11.45 : 10.72) : width < 980 ? 9.95 : 9.58;
        camera.updateProjectionMatrix();
        root.position.set(width < 640 ? 0 : width < 980 ? 0.08 : 0.2, width < 640 ? 0.12 : 0.08, 0);
      };

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mountElement);
      const visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          isInViewport = entry?.isIntersecting ?? true;
        },
        { threshold: 0.06 },
      );
      visibilityObserver.observe(mountElement);
      const handleVisibilityChange = () => {
        isTabVisible = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);
      resize();

      function clearLabel() {
        activeId = null;
        setLabel(null);
      }

      function setActive(facility: AtelierFacility, clientX: number, clientY: number) {
        activeId = facility.id;
        const rect = mountElement.getBoundingClientRect();
        setLabel({
          city: facility.city,
          region: facility.region,
          title: facility.title,
          note: facility.note,
          coordinates: formatAtelierCoordinates(facility.lat, facility.lon),
          nodeType: formatAtelierType(facility, copy),
          x: Math.min(Math.max(clientX - rect.left + 18, 18), Math.max(18, rect.width - 272)),
          y: Math.min(Math.max(clientY - rect.top - 30, 18), Math.max(18, rect.height - 152)),
        });
      }

      function updatePointer(clientX: number, clientY: number) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      }

      function getFacilityAt(clientX: number, clientY: number) {
        updatePointer(clientX, clientY);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(nodeObjects, true) as GlobeRayHit[];
        const hit = hits.find((entry) => entry.object.userData.facility || entry.object.parent?.userData?.facility);
        return hit?.object.userData.facility ?? (hit?.object.parent as GlobeNodeObject | undefined)?.userData.facility ?? null;
      }

      function handlePointerDown(event: PointerEvent) {
        dragging = true;
        hasDragged = false;
        lastX = event.clientX;
        lastY = event.clientY;
        renderer.domElement.setPointerCapture(event.pointerId);
      }

      function handlePointerMove(event: PointerEvent) {
        if (dragging) {
          const deltaX = event.clientX - lastX;
          const deltaY = event.clientY - lastY;
          lastX = event.clientX;
          lastY = event.clientY;
          if (Math.abs(deltaX) + Math.abs(deltaY) > 3) hasDragged = true;
          root.rotation.y += deltaX * 0.0045;
          root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + deltaY * 0.0032, -0.72, 0.72);
          yawVelocity = deltaX * 0.035;
          pitchVelocity = deltaY * 0.028;
          clearLabel();
          return;
        }

        const facility = getFacilityAt(event.clientX, event.clientY);
        if (facility) setActive(facility, event.clientX, event.clientY);
        else if (activeId) clearLabel();
      }

      function handlePointerUp(event: PointerEvent) {
        dragging = false;
        if (!hasDragged) {
          const facility = getFacilityAt(event.clientX, event.clientY);
          if (facility) setActive(facility, event.clientX, event.clientY);
          else clearLabel();
        }
        try {
          renderer.domElement.releasePointerCapture(event.pointerId);
        } catch (ignoredError) { void ignoredError; }
      }

      function selectCenteredNode() {
        const rect = mountElement.getBoundingClientRect();
        const scratch = new THREE.Vector3();
        let best: { facility: AtelierFacility; distance: number; x: number; y: number } | null = null;
        for (const node of nodeObjects) {
          node.getWorldPosition(scratch);
          if (scratch.z <= 0.16 || !node.userData.facility) continue;
          const projected = scratch.clone().project(camera);
          const x = (projected.x * 0.5 + 0.5) * rect.width;
          const y = (-projected.y * 0.5 + 0.5) * rect.height;
          const distance = (x - rect.width / 2) ** 2 + (y - rect.height / 2) ** 2;
          if (!best || distance < best.distance) best = { facility: node.userData.facility, distance, x, y };
        }
        if (best) setActive(best.facility, rect.left + best.x, rect.top + best.y);
      }

      function handleKeyDown(event: KeyboardEvent) {
        const step = event.shiftKey ? 0.2 : 0.095;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          root.rotation.y += event.key === "ArrowLeft" ? -step : step;
          yawVelocity = 0;
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + (event.key === "ArrowUp" ? -step : step), -0.72, 0.72);
          pitchVelocity = 0;
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCenteredNode();
        } else if (event.key === "Escape") {
          clearLabel();
        }
      }

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        setIsGlobeReady(false);
        setHasGlobeError(true);
      };

      mountElement.addEventListener("keydown", handleKeyDown);
      renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
      renderer.domElement.addEventListener("pointerdown", handlePointerDown);
      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("pointerup", handlePointerUp);
      renderer.domElement.addEventListener("pointercancel", handlePointerUp);
      renderer.domElement.addEventListener("pointerleave", () => {
        if (!dragging) clearLabel();
      });

      const worldPosition = new THREE.Vector3();
      const labelPosition = new THREE.Vector3();

      function animate() {
        if (disposed) return;
        animationFrame = requestAnimationFrame(animate);
        if (!isInViewport || !isTabVisible) return;

        const frameTime = performance.now();
        const delta = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
        lastFrameTime = frameTime;
        elapsed += delta;
        if (!dragging) {
          root.rotation.y += (prefersReducedMotion ? 0.008 : 0.042) * delta + yawVelocity * delta;
          root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + pitchVelocity * delta, -0.72, 0.72);
          const damping = Math.pow(0.045, delta);
          yawVelocity *= damping;
          pitchVelocity *= damping;
        }
        if (!prefersReducedMotion) {
          clouds.rotation.y += delta * 0.008;
          highClouds.rotation.y -= delta * 0.0035;
        }
        orbit.rotation.z += delta * (prefersReducedMotion ? 0.002 : 0.012);

        routeTravellers.forEach((traveller) => {
          const progress = (elapsed * traveller.speed + traveller.offset) % 1;
          const pathPosition = progress * (traveller.points.length - 1);
          const positionIndex = Math.min(traveller.points.length - 2, Math.floor(pathPosition));
          const nextIndex = Math.min(traveller.points.length - 1, positionIndex + 1);
          traveller.mesh.position.lerpVectors(
            traveller.points[positionIndex],
            traveller.points[nextIndex],
            pathPosition - positionIndex,
          );
          const pulse = 0.82 + Math.sin((elapsed + traveller.offset) * 5.2) * 0.16;
          traveller.mesh.scale.setScalar(pulse);
        });

        (starField.material as PointsMaterial).opacity = prefersReducedMotion ? 0.52 : 0.5 + Math.sin(elapsed * 0.5) * 0.07;
        (farStarField.material as PointsMaterial).opacity = prefersReducedMotion ? 0.38 : 0.36 + Math.cos(elapsed * 0.34) * 0.05;

        for (const node of nodeObjects) {
          node.getWorldPosition(worldPosition);
          const frontFacing = worldPosition.z > 0.06;
          node.visible = frontFacing;
          const active = node.userData.facility?.id === activeId;
          const pulse = 1 + Math.sin(elapsed * 2.25 + node.position.x) * 0.045;
          node.scale.setScalar((active ? 1.32 : 1) * pulse);
        }

        if (labelledNodeObjects.length && frameTime - lastLabelFrameTime >= 50) {
          lastLabelFrameTime = frameTime;
          const occupiedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
          for (const node of labelledNodeObjects) {
            const labelElement = node.userData.domLabel;
            if (!labelElement) continue;
            node.getWorldPosition(labelPosition);
            const depth = labelPosition.z;
            if (depth <= 0.42) {
              labelElement.style.opacity = "0";
              labelElement.style.transform = "translate3d(-9999px,-9999px,0)";
              continue;
            }
            labelPosition.project(camera);
            const x = (labelPosition.x * 0.5 + 0.5) * width;
            const y = (-labelPosition.y * 0.5 + 0.5) * height;
            const side = x > width * 0.63 ? -1 : 1;
            const left = side < 0 ? x - 158 : x + 25;
            const safeX = Math.min(Math.max(left, 18), width - 172);
            const safeY = Math.min(Math.max(y - 10, 18), height - 52);
            const box = { left: safeX - 5, right: safeX + 166, top: safeY - 4, bottom: safeY + 36 };
            const collides = occupiedBoxes.some(
              (entry) => box.left < entry.right && box.right > entry.left && box.top < entry.bottom && box.bottom > entry.top,
            );
            if (collides) {
              labelElement.style.opacity = "0";
              labelElement.style.transform = "translate3d(-9999px,-9999px,0)";
              continue;
            }
            occupiedBoxes.push(box);
            labelElement.style.opacity = depth > 1.15 ? "0.88" : "0.5";
            labelElement.style.transform = `translate3d(${safeX}px,${safeY}px,0)`;
            if (node.userData.domLabelSide !== side) {
              node.userData.domLabelSide = side;
              labelElement.style.textAlign = side < 0 ? "right" : "left";
              labelElement.style.borderLeft = side < 0 ? "0" : "1px solid rgba(214,183,122,.42)";
              labelElement.style.borderRight = side < 0 ? "1px solid rgba(214,183,122,.42)" : "0";
              labelElement.style.paddingLeft = side < 0 ? "0" : ".75rem";
              labelElement.style.paddingRight = side < 0 ? ".75rem" : "0";
            }
          }
        }

        renderer.render(scene, camera);
        if (!firstFrameRendered) {
          firstFrameRendered = true;
          window.clearTimeout(bootWatchdog);
          setHasGlobeError(false);
          setIsGlobeReady(true);
        }
      }

      animationFrame = requestAnimationFrame(animate);

      cleanup = () => {
        disposed = true;
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (animationFrame) cancelAnimationFrame(animationFrame);
        mountElement.removeEventListener("keydown", handleKeyDown);
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
        renderer.domElement.removeEventListener("pointermove", handlePointerMove);
        renderer.domElement.removeEventListener("pointerup", handlePointerUp);
        renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
        for (const node of labelledNodeObjects) node.userData.domLabel?.remove();
        nodeLabelLayerRef.current?.replaceChildren();
        scene.traverse((object: Object3D) => {
          const renderable = object as GlobeRenderableObject;
          renderable.geometry?.dispose?.();
          if (Array.isArray(renderable.material)) renderable.material.forEach((material) => material.dispose?.());
          else renderable.material?.dispose?.();
        });
        glowTexture?.dispose();
        loadedTextures.forEach((texture) => texture.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    boot().catch(() => {
      if (!disposed) setHasGlobeError(true);
    });

    return () => {
      disposed = true;
      window.clearTimeout(bootWatchdog);
      cleanup?.();
    };
  }, [copy, facilities]);

  return (
    <div
      className="group/globe relative h-full w-full overflow-hidden rounded-[1.25rem] border border-white/[0.075] bg-[#03070a] shadow-[0_44px_120px_rgba(0,0,0,0.58)] sm:rounded-[1.75rem]"
      role="img"
      aria-label={copy.visualAria}
      data-globe-ready={isGlobeReady ? "true" : "false"}
    >
      <AtelierSatellitePoster facilities={facilities} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_58%_48%,rgba(23,73,105,.22),transparent_31%),radial-gradient(circle_at_86%_18%,rgba(214,183,122,.11),transparent_26%),linear-gradient(145deg,rgba(255,255,255,.025),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.22)_0_.55px,transparent_.8px)] [background-size:37px_37px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,4,6,.48),transparent_21%,transparent_78%,rgba(2,4,6,.24))]" />

      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-velmere-gold/50 active:cursor-grabbing"
        role="button"
        tabIndex={0}
        aria-label={copy.controlAria}
        aria-disabled={hasGlobeError && !isGlobeReady}
      />
      <div ref={nodeLabelLayerRef} className="pointer-events-none absolute inset-0 z-10" />

      <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.10] bg-black/[0.35] px-2.5 py-2 font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/[0.55] backdrop-blur-md sm:left-5 sm:top-5 sm:px-3 sm:text-[9px] sm:tracking-[0.18em]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-200" />
        </span>
        <span className="sm:hidden">{copy.surfaceModeShort}</span>
        <span className="hidden sm:inline">{copy.surfaceMode}</span>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-20 hidden rounded-full border border-velmere-gold/15 bg-black/30 px-3 py-2 font-mono text-[8.5px] uppercase tracking-[0.18em] text-velmere-gold/60 backdrop-blur-md sm:right-5 sm:top-5 sm:block sm:text-[9px]">
        {copy.realCoordinates}
      </div>

      {!isGlobeReady && !hasGlobeError ? (
        <div className="atelier-globe-loading pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#03070a]/60 backdrop-blur-[2px]">
          <div className="relative overflow-hidden rounded-full border border-velmere-gold/20 bg-black/50 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.24em] text-white/[0.55]">
            <span className="relative z-10">{copy.loading}</span>
            <span className="absolute inset-y-0 -left-full w-full animate-[atelier-globe-loader_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-velmere-gold/20 to-transparent motion-reduce:animate-none" />
          </div>
        </div>
      ) : null}

      {label ? (
        <>
          <div
            className="pointer-events-none absolute z-30 hidden w-[15.5rem] rounded-2xl border border-velmere-gold/25 bg-[#030506]/[0.85] p-4 shadow-[0_20px_55px_rgba(0,0,0,.55)] backdrop-blur-xl xl:block"
            style={{ left: label.x, top: label.y }}
          >
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-velmere-gold/80">{label.region}</p>
            <p className="mt-1.5 text-sm font-medium text-white">{label.city}</p>
            <p className="mt-2 text-[10px] leading-5 text-white/[0.48]">{label.title}</p>
            <p className="mt-3 border-t border-white/[0.08] pt-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/[0.34]">
              {label.nodeType} · {label.coordinates}
            </p>
          </div>
          <div className="pointer-events-none absolute inset-x-4 bottom-16 z-30 rounded-2xl border border-velmere-gold/[0.22] bg-[#030506]/[0.88] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,.5)] backdrop-blur-xl xl:hidden">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-velmere-gold/80">{copy.selectedNode}</p>
            <p className="mt-1.5 text-sm font-medium text-white">{label.city}</p>
            <p className="mt-1 text-[10px] leading-5 text-white/50">{label.note}</p>
            <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.13em] text-white/[0.32]">
              {label.nodeType} · {label.coordinates}
            </p>
          </div>
        </>
      ) : null}

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/[0.28] sm:bottom-5 sm:left-5 sm:block">
        {copy.imageryCredit}
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-full border border-white/10 bg-black/[0.42] px-3 py-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/50 backdrop-blur-md sm:bottom-5 sm:right-5 sm:px-4 sm:text-[9px]">
        <span className="sm:hidden">{copy.dragTap}</span>
        <span className="hidden sm:inline">{copy.dragTapKeyboard}</span>
      </div>

      <ul className="sr-only">
        {facilities.map((facility) => (
          <li key={facility.id}>
            {facility.city} — {facility.region} — {facility.precision}
          </li>
        ))}
      </ul>

      <style>{`
        @keyframes atelier-globe-loader {
          0% { transform: translateX(0); }
          100% { transform: translateX(210%); }
        }
        :global(.atelier-node-label) {
          transition: opacity 240ms ease, filter 240ms ease;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}
