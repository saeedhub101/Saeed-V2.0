import test from "node:test";
import assert from "node:assert/strict";
import { verifyRestPoseSnapshot } from "../../src/character/rest-pose-validation.mjs";

function makeBone(offset = 0) {
  return {
    x: 0.1 + offset, y: -0.2 + offset, z: 0.3 + offset,
    qx: 0.01 + offset, qy: 0.02 + offset, qz: 0.03 + offset, qw: 0.99 - offset,
    position: { x: 1 + offset, y: 2 + offset, z: 3 + offset }
  };
}

function makeProfile(bones) {
  return { restPose: { bones: structuredClone(bones) } };
}

test("accepts a complete persisted rest-pose snapshot", () => {
  const bones = { Hips: makeBone(), Head: makeBone(0.001) };
  assert.equal(verifyRestPoseSnapshot(bones, makeProfile(bones)), true);
});

test("rejects a snapshot missing any quaternion component", () => {
  const bones = { Hips: makeBone() };
  const profile = makeProfile(bones);
  delete profile.restPose.bones.Hips.qw;
  assert.equal(verifyRestPoseSnapshot(bones, profile), false);
});

test("rejects a snapshot missing a bone position", () => {
  const bones = { Hips: makeBone() };
  const profile = makeProfile(bones);
  delete profile.restPose.bones.Hips.position;
  assert.equal(verifyRestPoseSnapshot(bones, profile), false);
});

test("rejects a snapshot with a changed position or rotation", () => {
  const bones = { Hips: makeBone() };
  const profile = makeProfile(bones);
  profile.restPose.bones.Hips.position.x += 0.01;
  assert.equal(verifyRestPoseSnapshot(bones, profile), false);
  profile.restPose.bones.Hips = makeBone();
  profile.restPose.bones.Hips.qy += 0.01;
  assert.equal(verifyRestPoseSnapshot(bones, profile), false);
});

test("rejects missing bones, empty captures, and non-finite values", () => {
  const bones = { Hips: makeBone(), Head: makeBone(0.001) };
  const profile = makeProfile(bones);
  delete profile.restPose.bones.Head;
  assert.equal(verifyRestPoseSnapshot(bones, profile), false);
  assert.equal(verifyRestPoseSnapshot({}, makeProfile({})), false);
  const invalid = { Hips: makeBone() };
  invalid.Hips.qx = Number.NaN;
  assert.equal(verifyRestPoseSnapshot(invalid, makeProfile(invalid)), false);
});

test("accepts numeric strings only when every required value is present and equal", () => {
  const bones = { Hips: makeBone() };
  const profile = makeProfile(bones);
  for (const key of ["x", "y", "z", "qx", "qy", "qz", "qw"]) {
    profile.restPose.bones.Hips[key] = String(profile.restPose.bones.Hips[key]);
  }
  for (const key of ["x", "y", "z"]) {
    profile.restPose.bones.Hips.position[key] = String(profile.restPose.bones.Hips.position[key]);
  }
  assert.equal(verifyRestPoseSnapshot(bones, profile), true);
});
