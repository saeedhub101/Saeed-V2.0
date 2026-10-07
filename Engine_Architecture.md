# Saeed V2.0 — Engine Architecture

**Status:** Authoritative Engine contract  
**Scope:** 3D engine, rendering, assets, GPU resources and runtime integration

## 1. Purpose

The Engine layer presents the Character Runtime and manages technical 3D resources.

The Engine is not the Character brain.

Character_Architecture.md decides behavior. Engine_Architecture.md decides how that behavior is represented safely and efficiently by the rendering/runtime engine.

## 2. Engine boundary

Character Runtime → motion/pose decisions → Engine adapter → scene/rig/asset representation → renderer → pixels.

The reverse direction must not allow the renderer to invent Character behavior.

## 3. Engine responsibilities

The Engine owns:

- 3D scene creation
- camera
- lights
- GLB/asset loading
- skeletal representation
- GPU resources
- render scheduling
- resize handling
- asset disposal
- animation/pose application requested by Character Runtime
- visual diagnostics

The Engine does not own:

- mood
- autonomous policy
- Brain routing
- tool permissions
- conversational history
- LLM decisions
- application lifecycle ownership

## 4. Render policy

Rendering is demand-driven.

Required active rendering may include motion playback, pose changes, loading, transitions, user interaction and visual effects.

When no visual change exists, continuous rendering should stop.

The Character may remain conceptually present while the Engine has no active render workload.

## 5. Asset loading contract

A new Character asset must pass validation before becoming authoritative.

Validation should cover:

- file readability
- supported format
- scene existence
- skeleton availability
- transform sanity
- scale sanity
- orientation sanity
- required logical capabilities
- material/resource validity
- memory feasibility
- safe disposal of temporary resources

## 6. Atomic Character replacement

Replacement is transactional:

1. keep current working Character
2. load candidate asset
3. validate candidate
4. construct temporary Engine representation
5. map logical rig capabilities
6. verify minimum required capabilities
7. commit replacement
8. dispose old Engine resources only after successful commit

If any stage fails, the old Character remains active.

## 7. Logical skeleton contract

Motion code uses logical joint identities.

The current asset may use different bone names.

CharacterRetargeter maps:

Logical Joint → Current Character Rig → Actual Engine Bone

Raw model-specific bone names must not leak into Brain or semantic Character events.

## 8. Missing capabilities

Missing optional bones are capabilities, not necessarily errors.

Examples:

- no fingers → arm/hand fallback
- no facial joints → available face capability
- no eye bones → head/gaze fallback

Required capabilities are explicitly declared by the Character Runtime contract.

## 9. GPU/resource lifetime

Every engine resource must have a clear owner and disposal path.

This includes scenes, meshes, materials, textures, geometries, skeleton resources, animation resources, render targets and browser/WebGL resources.

Destroying Character must release Engine resources.

A hidden Character must not retain a full active GPU/runtime workload merely for convenience.

## 10. Engine failure isolation

Invalid assets, shader/resource failures or renderer failures must not automatically terminate the whole application.

The Engine reports structured failure to Character/Core.

Recovery may retain the previous valid Character, enter a safe visual state, request a replacement or disable only the affected visual capability.

## 11. Engine performance rules

Performance improvements should prefer demand-driven rendering, lazy asset loading, resource disposal, bounded caches and reduced unnecessary updates.

Do not introduce permanent loops merely to simplify implementation.

## 12. Engine invariants

1. Renderer does not choose behavior.
2. Engine does not own Brain.
3. Engine does not own application shutdown.
4. Failed asset replacement cannot destroy the current valid Character.
5. Logical joints remain independent of model bone names.
6. Optional capabilities degrade gracefully.
7. Destroyed Character releases Engine resources.
8. Idle Character does not require a permanent render loop.
9. Engine events crossing into Character are semantic or technical state events, not arbitrary behavior commands.
10. All engine resources have an owner and disposal path.
