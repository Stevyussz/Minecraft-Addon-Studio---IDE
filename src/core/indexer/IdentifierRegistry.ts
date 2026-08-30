import * as path from 'path'
import type { FileIndexEntry, IdentifierRegistry as IdentifierRegistryType } from '../../shared/types'

/**
 * Builds a registry of all known Minecraft identifiers in the project.
 *
 * Identifiers are classified by file path context and JSON structure type.
 * e.g. a file in entities/ with identifier "test:zombie" → entities registry.
 */
export class IdentifierRegistry {
  build(entries: FileIndexEntry[]): IdentifierRegistryType {
    const registry: IdentifierRegistryType = {
      entities: [],
      items: [],
      blocks: [],
      animations: [],
      animationControllers: [],
      renderControllers: [],
      particles: [],
      sounds: [],
      functions: [],
    }

    for (const entry of entries) {
      const ids = entry.summary.identifiers ?? []
      if (ids.length === 0) continue

      const filePath = entry.path
      const dir = path.dirname(filePath).toLowerCase()
      const name = path.basename(filePath).toLowerCase()

      // Classify by directory/file structure
      if (dir.includes('/entities') || dir.includes('\\entities')) {
        addUnique(registry.entities, ...ids)
      } else if (dir.includes('/items') || dir.includes('\\items')) {
        addUnique(registry.items, ...ids)
      } else if (dir.includes('/blocks') || dir.includes('\\blocks')) {
        addUnique(registry.blocks, ...ids)
      } else if (dir.includes('/animations') && !dir.includes('controller')) {
        addUnique(registry.animations, ...ids)
      } else if (dir.includes('/animation_controllers') || dir.includes('\\animation_controllers') || name.includes('animation_controller')) {
        addUnique(registry.animationControllers, ...ids)
      } else if (dir.includes('/render_controllers') || dir.includes('\\render_controllers')) {
        addUnique(registry.renderControllers, ...ids)
      } else if (dir.includes('/particles') || dir.includes('\\particles')) {
        addUnique(registry.particles, ...ids)
      } else if (dir.includes('/sounds') || dir.includes('\\sounds')) {
        addUnique(registry.sounds, ...ids)
      } else if (dir.includes('/functions') || dir.includes('\\functions') || name.endsWith('.mcfunction')) {
        addUnique(registry.functions, ...ids)
      } else {
        // Fallback: classify by identifier prefix or summary type
        for (const id of ids) {
          if (id.includes(':')) {
            // Has namespace:name format — likely entity/item/block
            if (entry.summary.components && entry.summary.components.length > 0) {
              addUnique(registry.entities, id)
            } else {
              // Can't determine — put in entities as safe default
              addUnique(registry.entities, id)
            }
          }
        }
      }
    }

    // Sort all lists
    registry.entities.sort()
    registry.items.sort()
    registry.blocks.sort()
    registry.animations.sort()
    registry.animationControllers.sort()
    registry.renderControllers.sort()
    registry.particles.sort()
    registry.sounds.sort()
    registry.functions.sort()

    return registry
  }
}

function addUnique(arr: string[], ...items: string[]): void {
  for (const item of items) {
    if (item && !arr.includes(item)) {
      arr.push(item)
    }
  }
}
