import { describe, expect, it } from 'vitest'
import { ASSET_MANIFEST } from '../assets/manifest'
import { desktopTreeModelEntries } from '../assets/modelManifest'
import { validateAssetManifest } from '../assets/registry'
import { canLoadTreeModel, treeModelAssetForPack, treeModelInstanceLimit } from './TreeModelLayer'

describe('instanced Poly Haven tree selection', () => {
  it('selects the packaged Web 1K Tree Small 02 model and never substitutes a desktop pack', () => {
    const model = treeModelAssetForPack(ASSET_MANIFEST, 'web-1k')
    expect(model?.polyHavenSlug).toBe('tree_small_02')
    expect(model?.runtime.kind).toBe('model')
    expect(model?.runtime.files[0]?.path).toBe('/assets/polyhaven/web-1k/models/tree_small_02/tree_small_02_forest-lod2.glb')
    expect(model?.runtimeBudget.preload).toBe(true)
    expect(treeModelAssetForPack(ASSET_MANIFEST, 'desktop-2k')).toBeUndefined()
  })

  it('keeps real-tree instance counts bounded separately from texture-pack resolution', () => {
    expect(treeModelInstanceLimit('low', 512)).toBe(4)
    expect(treeModelInstanceLimit('medium', 512)).toBe(12)
    expect(treeModelInstanceLimit('high', 512)).toBe(24)
    expect(treeModelInstanceLimit('high', 7)).toBe(7)
    expect(canLoadTreeModel(512)).toBe(false)
    expect(canLoadTreeModel(1024)).toBe(true)
  })

  it('keeps desktop model paths outside the Web manifest and selects the forest variant over the photo hero', () => {
    const desktopModels = desktopTreeModelEntries('/assets/polyhaven')
    const desktop4Forest = treeModelAssetForPack(desktopModels, 'desktop-4k')
    expect(ASSET_MANIFEST.every((entry) => entry.pack === 'web-1k')).toBe(true)
    expect(desktop4Forest?.id).toBe('tree-small-02-desktop-4k')
    expect(desktop4Forest?.runtime.files[0]?.path).toBe('/assets/polyhaven/desktop-4k/models/tree_small_02/tree_small_02_forest-lod2.glb')
    expect(desktopModels.find((entry) => entry.id.endsWith('-hero'))?.runtimeBudget.maxInstances).toBe(3)
    expect(validateAssetManifest(desktopModels)).toEqual({ valid: true, errors: [] })
  })
})
