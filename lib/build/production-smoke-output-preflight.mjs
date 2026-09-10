import fs from "node:fs";

export function productionSmokeRequiredOutputs(outputContract) {
  return Object.freeze([
    Object.freeze({ label: "buildId", path: outputContract.buildIdPath, kind: "file" }),
    Object.freeze({ label: "routesManifest", path: outputContract.routesManifestPath, kind: "file" }),
    Object.freeze({ label: "requiredServerManifest", path: outputContract.requiredServerManifestPath, kind: "file" }),
    Object.freeze({ label: "standaloneServer", path: outputContract.standaloneServerPath, kind: "file" }),
    Object.freeze({ label: "standaloneNextBootstrap", path: outputContract.standaloneNextBootstrapPath, kind: "file" }),
    Object.freeze({ label: "standaloneStartServer", path: outputContract.standaloneStartServerPath, kind: "file" }),
    Object.freeze({ label: "standaloneSwcInteropDefault", path: outputContract.standaloneSwcInteropDefaultPath, kind: "file" }),
    Object.freeze({ label: "standaloneSwcInteropWildcard", path: outputContract.standaloneSwcInteropWildcardPath, kind: "file" }),
    Object.freeze({ label: "standaloneBuildId", path: outputContract.standaloneBuildIdPath, kind: "file" }),
    Object.freeze({ label: "standaloneStatic", path: outputContract.standaloneStaticPath, kind: "directory", nonEmpty: true }),
    Object.freeze({ label: "standalonePublic", path: outputContract.standalonePublicPath, kind: "directory", nonEmpty: true }),
  ]);
}

export function inspectProductionSmokeOutputPreflight(
  outputContract,
  { reportedPath = (value) => value } = {},
) {
  const results = productionSmokeRequiredOutputs(outputContract).map((entry) => {
    const displayPath = reportedPath(entry.path);
    let stat;
    try {
      stat = fs.lstatSync(entry.path);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return {
          ...entry,
          path: displayPath,
          ok: false,
          error: `required output missing:${displayPath}`,
        };
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      return {
        ...entry,
        path: displayPath,
        ok: false,
        error: `required output symlink rejected:${displayPath}`,
      };
    }
    const correctKind = entry.kind === "directory"
      ? stat.isDirectory()
      : stat.isFile();
    if (!correctKind) {
      return {
        ...entry,
        path: displayPath,
        ok: false,
        error: `required output wrong type:${displayPath}:expected_${entry.kind}`,
      };
    }
    if (
      entry.kind === "directory"
      && entry.nonEmpty
      && fs.readdirSync(entry.path).length === 0
    ) {
      return {
        ...entry,
        path: displayPath,
        ok: false,
        error: `required output empty directory:${displayPath}`,
      };
    }
    return {
      ...entry,
      path: displayPath,
      ok: true,
      error: null,
    };
  });
  const errors = results.filter((row) => !row.ok).map((row) => row.error);
  return {
    ok: errors.length === 0,
    denominator: results.length,
    passed: results.filter((row) => row.ok).length,
    errors,
    results,
  };
}
