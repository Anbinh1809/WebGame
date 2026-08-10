import { describe, expect, it } from 'vitest'
import { ASSET_MANIFEST } from '../assets/manifest'
import { desktopEnvironmentModelEntries, WEB_ENVIRONMENT_MODEL_ASSET_MANIFEST } from '../assets/environmentModelManifest'
import { desktopSettlementModelEntries, WEB_SETTLEMENT_MODEL_ASSET_MANIFEST } from '../assets/settlementModelManifest'
import { desktopTreeModelEntries } from '../assets/modelManifest'
import { desktopRockModelEntries } from '../assets/rockModelManifest'
import { validateAssetManifest } from '../assets/registry'
import {
  canLoadTreeModel,
  coastRockModelAssetForPack,
  groundCoverModelAssetForPack,
  groundCoverModelInstanceLimit,
  rockModelAssetForPack,
  settlementLanternModelAssetForPack,
  settlementPropModelInstanceLimit,
  settlementStockpileModelAssetForPack,
  sparseEnvironmentModelInstanceLimit,
  treeModelAssetForPack,
  treeModelInstanceLimit,
} from './TreeModelLayer'

describe('instanced Poly Haven tree selection', () => {
  it('selects the packaged Web 1K island tree and never substitutes a desktop pack', () => {
    const model = treeModelAssetForPack(ASSET_MANIFEST, 'web-1k')
    expect(model?.polyHavenSlug).toBe('island_tree_01')
    expect(model?.runtime.kind).toBe('model')
    expect(model?.runtime.files[0]?.path).toBe('/assets/polyhaven/web-1k/models/island_tree_01/island_tree_01_forest-lod1.glb')
    expect(model?.runtime.kind === 'model' && model.runtime.worldScale).toBe(0.18)
    expect(model?.runtimeBudget.preload).toBe(false)
    expect(treeModelAssetForPack(ASSET_MANIFEST, 'desktop-2k')).toBeUndefined()
  })

  it('keeps real-tree instance counts bounded separately from texture-pack resolution', () => {
    expect(treeModelInstanceLimit('low', 512)).toBe(4)
    expect(treeModelInstanceLimit('medium', 512)).toBe(12)
    expect(treeModelInstanceLimit('high', 512)).toBe(24)
    expect(treeModelInstanceLimit('ultra', 512)).toBe(36)
    expect(treeModelInstanceLimit('high', 7)).toBe(7)
    expect(treeModelInstanceLimit('low', 4)).toBe(1)
    expect(treeModelInstanceLimit('medium', 4)).toBe(2)
    expect(treeModelInstanceLimit('high', 4)).toBe(4)
    expect(treeModelInstanceLimit('low', 8)).toBe(1)
    expect(treeModelInstanceLimit('medium', 8)).toBe(4)
    expect(treeModelInstanceLimit('high', 8)).toBe(8)
    expect(canLoadTreeModel(512)).toBe(false)
    expect(canLoadTreeModel(1024)).toBe(true)
  })

  it('keeps hero environment meshes sparse while allowing a denser, bounded fern layer', () => {
    expect(sparseEnvironmentModelInstanceLimit('low', 32)).toBe(1)
    expect(sparseEnvironmentModelInstanceLimit('medium', 32)).toBe(2)
    expect(sparseEnvironmentModelInstanceLimit('high', 32)).toBe(3)
    expect(sparseEnvironmentModelInstanceLimit('ultra', 32)).toBe(4)
    expect(groundCoverModelInstanceLimit('low', 72)).toBe(4)
    expect(groundCoverModelInstanceLimit('medium', 72)).toBe(8)
    expect(groundCoverModelInstanceLimit('high', 72)).toBe(12)
    expect(groundCoverModelInstanceLimit('ultra', 72)).toBe(16)
    expect(settlementPropModelInstanceLimit('low', 40)).toBe(1)
    expect(settlementPropModelInstanceLimit('medium', 40)).toBe(2)
    expect(settlementPropModelInstanceLimit('high', 40)).toBe(3)
    expect(settlementPropModelInstanceLimit('ultra', 40)).toBe(4)
  })

  it('keeps desktop model paths outside the Web manifest and selects the wide forest variant over the photo hero', () => {
    const desktopModels = desktopTreeModelEntries('/assets/polyhaven')
    const desktop4Forest = treeModelAssetForPack(desktopModels, 'desktop-4k')
    expect(ASSET_MANIFEST.every((entry) => entry.pack === 'web-1k')).toBe(true)
    expect(desktop4Forest?.id).toBe('jacaranda-tree-desktop-4k')
    expect(desktop4Forest?.runtime.files[0]?.path).toBe('/assets/polyhaven/desktop-4k/models/jacaranda_tree/jacaranda_tree_forest-lod1.glb')
    expect(treeModelAssetForPack(desktopModels, 'cinema-8k')?.id).toBe('jacaranda-tree-desktop-4k')
    expect(desktopModels.find((entry) => entry.id.endsWith('-hero'))?.runtimeBudget.maxInstances).toBe(3)
    expect(validateAssetManifest(desktopModels)).toEqual({ valid: true, errors: [] })
  })

  it('selects a bounded, locally packaged boulder without treating it as foliage', () => {
    const rock = rockModelAssetForPack(ASSET_MANIFEST, 'web-1k')
    expect(rock?.polyHavenSlug).toBe('boulder_01')
    expect(rock?.runtime.kind).toBe('model')
    expect(rock?.runtime.kind === 'model' && rock.runtime.modelType).toBe('rock')
    expect(rock?.runtime.files[0]?.path).toBe('/assets/polyhaven/web-1k/models/boulder_01/boulder_01_formation-lod1.glb')
    expect(rock?.runtimeBudget.maxInstances).toBe(10)
    const desktopRock = rockModelAssetForPack(desktopRockModelEntries('/assets/polyhaven'), 'desktop-4k')
    expect(desktopRock?.runtime.files[0]?.path).toBe('/assets/polyhaven/desktop-4k/models/rock_face_01/rock_face_01_formation-lod0.glb')
    expect(rockModelAssetForPack(desktopRockModelEntries('/assets/polyhaven'), 'cinema-8k')?.id).toBe('rock-face-01-desktop-4k')
  })

  it('keeps ground-cover and shoreline models local through every source-resolution pack', () => {
    const webGround = groundCoverModelAssetForPack(ASSET_MANIFEST, 'web-1k')
    const webCoast = coastRockModelAssetForPack(ASSET_MANIFEST, 'web-1k')
    const desktopModels = desktopEnvironmentModelEntries('/assets/polyhaven')
    expect(webGround?.polyHavenSlug).toBe('fern_02')
    expect(webCoast?.polyHavenSlug).toBe('coast_rocks_05')
    expect(webGround?.runtime.kind === 'model' && webGround.runtime.modelType).toBe('groundCover')
    expect(webCoast?.runtime.kind === 'model' && webCoast.runtime.modelType).toBe('coastRock')
    expect(groundCoverModelAssetForPack(desktopModels, 'cinema-8k')?.runtime.files[0]?.path).toBe('/assets/polyhaven/cinema-8k/models/fern_02/fern_02_ground-lod1.glb')
    expect(coastRockModelAssetForPack(desktopModels, 'cinema-8k')?.runtime.files[0]?.path).toBe('/assets/polyhaven/cinema-8k/models/coast_rocks_05/coast_rocks_05_coast-lod1.glb')
    expect(validateAssetManifest([...WEB_ENVIRONMENT_MODEL_ASSET_MANIFEST, ...desktopModels])).toEqual({ valid: true, errors: [] })
  })

  it('replaces village lanterns and workshop stockpiles with deferred local models in every pack', () => {
    const lantern = settlementLanternModelAssetForPack(ASSET_MANIFEST, 'web-1k')
    const stockpile = settlementStockpileModelAssetForPack(ASSET_MANIFEST, 'web-1k')
    const desktopModels = desktopSettlementModelEntries('/assets/polyhaven')

    expect(lantern?.polyHavenSlug).toBe('wooden_lantern_01')
    expect(lantern?.runtime.kind === 'model' && lantern.runtime.modelType).toBe('settlementProp')
    expect(lantern?.runtime.files[0]?.path).toBe('/assets/polyhaven/web-1k/models/wooden_lantern_01/wooden_lantern_01_lantern-lod1.glb')
    expect(lantern?.runtimeBudget.preload).toBe(false)
    expect(stockpile?.polyHavenSlug).toBe('wooden_barrels_01')
    expect(stockpile?.runtime.files[0]?.path).toBe('/assets/polyhaven/web-1k/models/wooden_barrels_01/wooden_barrels_01_stockpile-lod1.glb')
    expect(settlementLanternModelAssetForPack(desktopModels, 'desktop-4k')?.runtime.files[0]?.path).toBe('/assets/polyhaven/desktop-4k/models/wooden_lantern_01/wooden_lantern_01_lantern-lod1.glb')
    expect(settlementStockpileModelAssetForPack(desktopModels, 'cinema-8k')?.runtime.files[0]?.path).toBe('/assets/polyhaven/cinema-8k/models/wooden_barrels_01/wooden_barrels_01_stockpile-lod1.glb')
    expect(validateAssetManifest([...WEB_SETTLEMENT_MODEL_ASSET_MANIFEST, ...desktopModels])).toEqual({ valid: true, errors: [] })
  })
})
