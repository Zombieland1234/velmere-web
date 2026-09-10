type PremiumAmbientGlobeProps = {
  className?: string;
  tone?: "gold" | "teal" | "ivory";
  locations?: ReadonlyArray<GlobeLocation>;
};

type GlobeLocation = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
};

type ProjectedPoint = {
  x: number;
  y: number;
  depth: number;
};

const DEG = Math.PI / 180;
const GLOBE_CENTER = 160;
const GLOBE_RADIUS = 152.5;
const PROJECTION_LATITUDE = 13 * DEG;
const PROJECTION_LONGITUDE = 19 * DEG;
const SIN_PROJECTION_LATITUDE = Math.sin(PROJECTION_LATITUDE);
const COS_PROJECTION_LATITUDE = Math.cos(PROJECTION_LATITUDE);

const GLOBE_LOCATIONS: readonly GlobeLocation[] = [
  { id: "london", latitude: 51.5074, longitude: -0.1278 },
  { id: "paris", latitude: 48.8566, longitude: 2.3522 },
  { id: "milan", latitude: 45.4642, longitude: 9.19 },
  { id: "warsaw", latitude: 52.2297, longitude: 21.0122 },
  { id: "istanbul", latitude: 41.0082, longitude: 28.9784 },
  { id: "casablanca", latitude: 33.5731, longitude: -7.5898 },
  { id: "lagos", latitude: 6.5244, longitude: 3.3792 },
  { id: "nairobi", latitude: -1.2921, longitude: 36.8219 },
  { id: "cape-town", latitude: -33.9249, longitude: 18.4241 },
  { id: "dubai", latitude: 25.2048, longitude: 55.2708 },
  { id: "mumbai", latitude: 19.076, longitude: 72.8777 },
  { id: "singapore", latitude: 1.3521, longitude: 103.8198 },
] as const;

const GLOBE_ROUTE_IDS = [
  ["london", "warsaw"],
  ["paris", "milan"],
  ["milan", "istanbul"],
  ["istanbul", "dubai"],
  ["dubai", "mumbai"],
  ["mumbai", "singapore"],
  ["paris", "casablanca"],
  ["casablanca", "lagos"],
  ["lagos", "nairobi"],
  ["nairobi", "cape-town"],
] as const;

function projectOrthographic(latitudeDegrees: number, longitudeDegrees: number): ProjectedPoint {
  const latitude = latitudeDegrees * DEG;
  const longitude = longitudeDegrees * DEG;
  const longitudeDelta = longitude - PROJECTION_LONGITUDE;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const depth =
    SIN_PROJECTION_LATITUDE * sinLatitude +
    COS_PROJECTION_LATITUDE * cosLatitude * Math.cos(longitudeDelta);

  return {
    x: GLOBE_CENTER + GLOBE_RADIUS * cosLatitude * Math.sin(longitudeDelta),
    y:
      GLOBE_CENTER -
      GLOBE_RADIUS *
        (COS_PROJECTION_LATITUDE * sinLatitude -
          SIN_PROJECTION_LATITUDE * cosLatitude * Math.cos(longitudeDelta)),
    depth,
  };
}

function buildProjectedLine(samples: ReadonlyArray<readonly [number, number]>) {
  let path = "";
  let drawing = false;

  for (const [latitude, longitude] of samples) {
    const point = projectOrthographic(latitude, longitude);
    if (point.depth <= 0.012) {
      drawing = false;
      continue;
    }
    path += `${drawing ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    drawing = true;
  }

  return path;
}

function buildProjectionGrid() {
  const paths: string[] = [];
  for (const latitude of [-60, -30, 0, 30, 60]) {
    const samples: Array<readonly [number, number]> = [];
    for (let longitude = -180; longitude <= 180; longitude += 2) samples.push([latitude, longitude]);
    paths.push(buildProjectedLine(samples));
  }
  for (const longitude of [-71, -41, -11, 19, 49, 79, 109]) {
    const samples: Array<readonly [number, number]> = [];
    for (let latitude = -88; latitude <= 88; latitude += 2) samples.push([latitude, longitude]);
    paths.push(buildProjectedLine(samples));
  }
  return paths.filter(Boolean);
}

function toSphereVector(location: GlobeLocation): readonly [number, number, number] {
  const latitude = location.latitude * DEG;
  const longitude = location.longitude * DEG;
  const cosLatitude = Math.cos(latitude);
  return [
    cosLatitude * Math.cos(longitude),
    cosLatitude * Math.sin(longitude),
    Math.sin(latitude),
  ];
}

function buildGreatCirclePath(from: GlobeLocation, to: GlobeLocation) {
  const start = toSphereVector(from);
  const end = toSphereVector(to);
  const dot = Math.max(-1, Math.min(1, start[0] * end[0] + start[1] * end[1] + start[2] * end[2]));
  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const samples: Array<readonly [number, number]> = [];

  for (let index = 0; index <= 48; index += 1) {
    const progress = index / 48;
    const startWeight = sinAngle < 0.0001 ? 1 - progress : Math.sin((1 - progress) * angle) / sinAngle;
    const endWeight = sinAngle < 0.0001 ? progress : Math.sin(progress * angle) / sinAngle;
    const x = start[0] * startWeight + end[0] * endWeight;
    const y = start[1] * startWeight + end[1] * endWeight;
    const z = start[2] * startWeight + end[2] * endWeight;
    const magnitude = Math.hypot(x, y, z) || 1;
    const latitude = Math.asin(z / magnitude) / DEG;
    const longitude = Math.atan2(y, x) / DEG;
    samples.push([latitude, longitude]);
  }

  return buildProjectedLine(samples);
}

const PROJECTED_LOCATIONS = GLOBE_LOCATIONS.map((location) => ({
  ...location,
  ...projectOrthographic(location.latitude, location.longitude),
})).filter((location) => location.depth > 0.025);

const LOCATION_BY_ID = new Map(GLOBE_LOCATIONS.map((location) => [location.id, location]));
const PROJECTED_ROUTES = GLOBE_ROUTE_IDS.map(([fromId, toId]) => {
  const from = LOCATION_BY_ID.get(fromId);
  const to = LOCATION_BY_ID.get(toId);
  return from && to ? { id: `${fromId}-${toId}`, path: buildGreatCirclePath(from, to) } : null;
}).filter((route): route is { id: string; path: string } => Boolean(route?.path));

const PROJECTED_GRID = buildProjectionGrid();

export default function PremiumAmbientGlobe({
  className = "",
  tone = "gold",
  locations,
}: PremiumAmbientGlobeProps) {
  const projectedLocations = locations?.length
    ? locations
        .map((location) => ({
          ...location,
          ...projectOrthographic(location.latitude, location.longitude),
        }))
        .filter((location) => location.depth > 0.025)
    : PROJECTED_LOCATIONS;
  const projectedRoutes = locations?.length ? [] : PROJECTED_ROUTES;

  return (
    <div
      className={`premium-ambient-globe ${className}`.trim()}
      data-tone={tone}
      data-projection="orthographic-19e-13n"
      aria-hidden="true"
    >
      <span className="premium-ambient-globe__aura" />
      <span className="premium-ambient-globe__orbit premium-ambient-globe__orbit--outer">
        <i />
      </span>
      <span className="premium-ambient-globe__orbit premium-ambient-globe__orbit--tilted">
        <i />
      </span>

      <span className="premium-ambient-globe__sphere">
        <span className="premium-ambient-globe__land" />
        <svg viewBox="0 0 320 320" focusable="false" role="presentation">
          <clipPath id="premium-globe-geography-clip">
            <circle cx="160" cy="160" r="152.5" />
          </clipPath>
          <g clipPath="url(#premium-globe-geography-clip)">
            <g className="premium-ambient-globe__grid" fill="none">
              {PROJECTED_GRID.map((path, index) => <path key={`grid-${index}`} d={path} />)}
            </g>
            <g className="premium-ambient-globe__routes" fill="none">
              {projectedRoutes.map((route) => <path key={route.id} d={route.path} />)}
            </g>
            <g className="premium-ambient-globe__nodes">
              {projectedLocations.map((location, index) => (
                <g
                  key={location.id}
                  data-location={location.id}
                  data-latitude={location.latitude.toFixed(4)}
                  data-longitude={location.longitude.toFixed(4)}
                  transform={`translate(${location.x.toFixed(2)} ${location.y.toFixed(2)})`}
                  style={{ animationDelay: `${index * -0.43}s` }}
                >
                  <circle className="premium-ambient-globe__node-halo" r="5.6" />
                  <circle className="premium-ambient-globe__node-core" r="1.7" />
                  {location.label ? (
                    <text
                      className="premium-ambient-globe__node-label"
                      x={index % 2 ? -8 : 8}
                      y={index % 2 ? 11 : -7}
                      textAnchor={index % 2 ? "end" : "start"}
                    >
                      {location.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
          </g>
        </svg>
        <span className="premium-ambient-globe__terminator" />
        <span className="premium-ambient-globe__scan" />
        <span className="premium-ambient-globe__glint" />
      </span>
    </div>
  );
}
