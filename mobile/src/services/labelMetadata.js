/**
 * Label Metadata Service
 * ──────────────────────
 * JavaScript port of ai-service/app/model/label_metadata.py.
 *
 * Parses flat model labels (e.g. "Tomato___Late_blight" or
 * "Tomato - Late blight") into structured metadata objects with
 * crop name, disease name, category, and healthy status.
 *
 * This runs entirely on-device so the mobile app can produce the
 * same label structure as the server without network access.
 */

const HEALTHY_TERMS = new Set(['healthy', 'normal', 'no disease', 'none']);

/**
 * Replace underscores and hyphens with spaces and title-case the result.
 * @param {string} value
 * @returns {string}
 */
function humanize(value) {
  const cleaned = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Unknown';

  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parse a model label into structured metadata.
 *
 * Supports common dataset label formats:
 * - PlantVillage:   "Tomato___Late_blight"
 * - Display labels: "Tomato - Late blight"
 * - Double under:   "Tomato__Late_blight"
 * - Generic:        "Rust", "Healthy"
 *
 * @param {string} label - Raw model output label.
 * @returns {{
 *   rawLabel: string,
 *   cropName: string,
 *   diseaseName: string,
 *   displayName: string,
 *   isHealthy: boolean,
 *   category: string,
 * }}
 */
export function parseLabel(label) {
  const rawLabel = label ? label.trim() : 'Unknown';

  let cropPart;
  let diseasePart;

  if (rawLabel.includes('___')) {
    [cropPart, diseasePart] = rawLabel.split('___', 2);
  } else if (rawLabel.includes(' - ')) {
    [cropPart, diseasePart] = rawLabel.split(' - ', 2);
  } else if (rawLabel.includes('__')) {
    [cropPart, diseasePart] = rawLabel.split('__', 2);
  } else {
    cropPart = 'Unknown';
    diseasePart = rawLabel;
  }

  const cropName = humanize(cropPart);
  let diseaseName = humanize(diseasePart);
  const normalizedDisease = diseaseName.toLowerCase();

  const isHealthy =
    HEALTHY_TERMS.has(normalizedDisease) ||
    normalizedDisease.includes('healthy');

  if (isHealthy) {
    diseaseName = 'Healthy';
  }

  let category;
  if (isHealthy) {
    category = 'healthy';
  } else if (
    ['blight', 'rot', 'mold', 'mildew', 'scab'].some((t) =>
      normalizedDisease.includes(t),
    )
  ) {
    category = 'fungal';
  } else if (
    ['virus', 'mosaic', 'curl'].some((t) => normalizedDisease.includes(t))
  ) {
    category = 'viral';
  } else if (
    ['spot', 'speck', 'bacterial'].some((t) => normalizedDisease.includes(t))
  ) {
    category = 'bacterial';
  } else if (normalizedDisease.includes('rust')) {
    category = 'fungal';
  } else {
    category = 'unknown';
  }

  const displayName =
    cropName === 'Unknown'
      ? diseaseName
      : `${cropName} - ${diseaseName}`;

  return {
    rawLabel,
    cropName,
    diseaseName,
    displayName,
    isHealthy,
    category,
  };
}
