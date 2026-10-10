export function verifyRestPoseSnapshot(capturedBones, storedProfile, tolerance = 1e-7) {
  if (!capturedBones || typeof capturedBones !== "object" || Array.isArray(capturedBones)) return false;
  if (!Number.isFinite(tolerance) || tolerance < 0) return false;

  const names = Object.keys(capturedBones);
  if (names.length === 0) return false;

  const storedBones = storedProfile?.restPose?.bones;
  if (!storedBones || typeof storedBones !== "object" || Array.isArray(storedBones)) return false;

  const rotationKeys = ["x", "y", "z", "qx", "qy", "qz", "qw"];
  const positionKeys = ["x", "y", "z"];

  for (const name of names) {
    const captured = capturedBones[name];
    const stored = storedBones[name];
    if (!captured || typeof captured !== "object" || !stored || typeof stored !== "object") return false;

    for (const key of rotationKeys) {
      const expected = Number(captured[key]);
      const actual = Number(stored[key]);
      if (!Number.isFinite(expected) || !Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) return false;
    }

    const expectedPosition = captured.position;
    const actualPosition = stored.position;
    if (!expectedPosition || typeof expectedPosition !== "object" ||
        !actualPosition || typeof actualPosition !== "object") return false;

    for (const key of positionKeys) {
      const expected = Number(expectedPosition[key]);
      const actual = Number(actualPosition[key]);
      if (!Number.isFinite(expected) || !Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) return false;
    }
  }

  return true;
}
