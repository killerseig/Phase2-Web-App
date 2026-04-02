import { describe, expect, it } from 'vitest'
import {
  buildCatalogSearchNodeIndex,
  createCatalogPathResolver,
  rankCatalogSearchMatchStrength,
  resolveCatalogSearchMatchStrength,
} from '@/utils/catalogSearch'

describe('catalogSearch utilities', () => {
  it('builds a searchable node graph that supports category children under parent items', () => {
    const index = buildCatalogSearchNodeIndex({
      categories: [
        { id: 'cat-bits', name: 'Bits', parentId: 'item-driver-kit', active: true },
      ],
      items: [
        { id: 'driver-kit', description: 'Driver Kit', active: true },
        { id: 'bit-1', description: 'Phillips Bit', categoryId: 'cat-bits', active: true },
      ],
    })

    expect(index.rootItemNodeIds).toEqual(['item-driver-kit'])
    expect(index.childIds.get('item-driver-kit')).toEqual(['cat-bits'])
    expect(index.childIds.get('cat-bits')).toEqual(['item-bit-1'])

    const { getPathSegments, getAncestorNodeIds } = createCatalogPathResolver(index.nodesById)
    expect(getPathSegments('item-bit-1')).toEqual(['Driver Kit', 'Bits', 'Phillips Bit'])
    expect(getAncestorNodeIds('item-bit-1')).toEqual(['item-driver-kit', 'cat-bits'])
  })

  it('scores search matches in the expected priority order', () => {
    const record = {
      primaryText: 'lag anchor',
      secondaryText: 'an-200',
      tertiaryText: 'fasteners anchors lag anchor',
    }

    expect(resolveCatalogSearchMatchStrength(record, ['lag', 'anchor'])).toBe('primary')
    expect(resolveCatalogSearchMatchStrength(record, ['an-200'])).toBe('secondary')
    expect(resolveCatalogSearchMatchStrength(record, ['fasteners', 'anchors'])).toBe('tertiary')
    expect(rankCatalogSearchMatchStrength('primary')).toBeLessThan(rankCatalogSearchMatchStrength('secondary'))
    expect(rankCatalogSearchMatchStrength('secondary')).toBeLessThan(rankCatalogSearchMatchStrength('tertiary'))
  })
})
