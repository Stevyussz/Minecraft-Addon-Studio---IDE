import type { Diagnostic, MinecraftManifest } from '../../shared/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates Minecraft Bedrock manifest.json files.
 *
 * Checks:
 *   - Required fields presence
 *   - UUID format
 *   - Version array format [major, minor, patch]
 *   - Module type validity
 *   - Dependency UUIDs
 */
export class JsonValidator {
  /**
   * Validate a manifest.json.
   * Returns diagnostics (empty array = valid).
   */
  static validateManifest(filePath: string, parsed: unknown): Diagnostic[] {
    const diags: Diagnostic[] = []

    if (typeof parsed !== 'object' || parsed === null) {
      diags.push(err(filePath, 'manifest.json must be a JSON object'))
      return diags
    }

    const obj = parsed as Record<string, unknown>

    // format_version
    if (!('format_version' in obj)) {
      diags.push(err(filePath, 'Missing required field: format_version'))
    } else if (typeof obj['format_version'] !== 'number') {
      diags.push(warn(filePath, 'format_version should be a number (e.g. 2)'))
    }

    // header
    if (!('header' in obj) || typeof obj['header'] !== 'object' || obj['header'] === null) {
      diags.push(err(filePath, 'Missing required field: header'))
      return diags
    }

    const header = obj['header'] as Record<string, unknown>

    // header.name
    if (!header['name'] || typeof header['name'] !== 'string') {
      diags.push(err(filePath, 'header.name is required and must be a string'))
    }

    // header.uuid
    if (!header['uuid']) {
      diags.push(err(filePath, 'header.uuid is required'))
    } else if (typeof header['uuid'] !== 'string' || !UUID_REGEX.test(header['uuid'] as string)) {
      diags.push(err(filePath, `header.uuid is not a valid UUID: "${header['uuid']}"`, 'manifest/invalid-uuid'))
    }

    // header.version
    if (!header['version']) {
      diags.push(err(filePath, 'header.version is required (array of 3 numbers, e.g. [1, 0, 0])'))
    } else if (!isVersionArray(header['version'])) {
      diags.push(err(filePath, 'header.version must be an array of 3 non-negative integers, e.g. [1, 0, 0]', 'manifest/invalid-version'))
    }

    // modules
    if (!('modules' in obj)) {
      diags.push(warn(filePath, 'Missing modules array — pack may not function correctly'))
    } else if (!Array.isArray(obj['modules'])) {
      diags.push(err(filePath, 'modules must be an array'))
    } else {
      const modules = obj['modules'] as unknown[]
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i]
        if (typeof mod !== 'object' || mod === null) {
          diags.push(err(filePath, `modules[${i}] must be an object`))
          continue
        }
        const m = mod as Record<string, unknown>

        if (!m['uuid'] || typeof m['uuid'] !== 'string') {
          diags.push(err(filePath, `modules[${i}].uuid is required`))
        } else if (!UUID_REGEX.test(m['uuid'] as string)) {
          diags.push(err(filePath, `modules[${i}].uuid is not a valid UUID`, 'manifest/invalid-uuid'))
        }

        if (!m['type'] || typeof m['type'] !== 'string') {
          diags.push(err(filePath, `modules[${i}].type is required (e.g. "data", "resources", "script")`))
        } else {
          const validTypes = ['data', 'resources', 'script', 'javascript', 'world_template', 'skin_pack']
          if (!validTypes.includes(m['type'] as string)) {
            diags.push(warn(filePath, `modules[${i}].type "${m['type']}" is not a standard Bedrock module type`))
          }
        }

        if (!isVersionArray(m['version'])) {
          diags.push(err(filePath, `modules[${i}].version must be [major, minor, patch]`, 'manifest/invalid-version'))
        }
      }

      // Check for duplicate UUIDs
      const uuids = modules
        .map(m => (typeof m === 'object' && m !== null ? (m as Record<string, unknown>)['uuid'] : null))
        .filter((u): u is string => typeof u === 'string')

      const seen = new Set<string>()
      for (const uuid of uuids) {
        if (seen.has(uuid)) {
          diags.push(err(filePath, `Duplicate module UUID: ${uuid}`, 'manifest/duplicate-uuid'))
        }
        seen.add(uuid)
      }
    }

    // dependencies validation
    if ('dependencies' in obj && Array.isArray(obj['dependencies'])) {
      const deps = obj['dependencies'] as unknown[]
      for (let i = 0; i < deps.length; i++) {
        const dep = deps[i]
        if (typeof dep !== 'object' || dep === null) continue
        const d = dep as Record<string, unknown>
        if (d['uuid'] && typeof d['uuid'] === 'string' && !UUID_REGEX.test(d['uuid'] as string)) {
          diags.push(err(filePath, `dependencies[${i}].uuid is not a valid UUID`, 'manifest/invalid-uuid'))
        }
      }
    }

    return diags
  }

  /**
   * Validate any generic JSON file for basic correctness.
   * Returns true if valid JSON with object root.
   */
  static isValidJsonObject(content: string): { valid: boolean; error?: string } {
    try {
      const parsed = JSON.parse(content)
      if (typeof parsed !== 'object' || parsed === null) {
        return { valid: false, error: 'Root value must be a JSON object' }
      }
      return { valid: true }
    } catch (e) {
      return { valid: false, error: String(e) }
    }
  }
}

function err(file: string, message: string, code?: string): Diagnostic {
  return { severity: 'error', file, message, code: code ?? 'manifest/error', source: 'manifest-validator' }
}

function warn(file: string, message: string, code?: string): Diagnostic {
  return { severity: 'warning', file, message, code: code ?? 'manifest/warning', source: 'manifest-validator' }
}

function isVersionArray(val: unknown): boolean {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every(n => typeof n === 'number' && n >= 0 && Number.isInteger(n))
  )
}
