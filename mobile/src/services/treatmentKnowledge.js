/**
 * Treatment Knowledge Service
 * ───────────────────────────
 * JavaScript port of ai-service/app/services/treatment_knowledge.py.
 *
 * Provides crop-specific treatment advice and farmer-friendly guidance
 * for on-device predictions. The knowledge base matches the server
 * exactly so offline results have the same advice quality.
 */

// ── Crop-Specific Treatment Guides ──────────────────────────────────

const CROP_TREATMENT_GUIDES = {
  tomato: {
    fungal: [
      'Remove badly infected leaves and avoid overhead irrigation.',
      'Improve airflow by spacing plants and pruning dense foliage.',
      'Ask a local agronomist about an appropriate fungicide for tomato in your region.',
    ],
    bacterial: [
      'Avoid working in the crop when leaves are wet.',
      'Remove infected plant debris away from the field.',
      'Use copper-based treatment only with local agronomist guidance.',
    ],
    viral: [
      'Remove severely affected plants to reduce spread.',
      'Control whiteflies, aphids, and other insect vectors.',
      'Use resistant varieties and clean seedlings for the next planting.',
    ],
  },
  potato: {
    fungal: [
      'Remove infected foliage where practical and keep rows well ventilated.',
      'Avoid wet leaves late in the day.',
      'Confirm with an agronomist before applying potato blight fungicide.',
    ],
  },
  apple: {
    fungal: [
      'Prune crowded branches to increase airflow.',
      'Remove fallen infected leaves and fruit from the orchard floor.',
      'Use a locally recommended orchard spray schedule after expert confirmation.',
    ],
  },
  corn: {
    fungal: [
      'Scout nearby plants and note whether lesions are spreading upward.',
      'Avoid excessive nitrogen and manage crop residue after harvest.',
      'Consult an agronomist about hybrid resistance and fungicide timing.',
    ],
  },
  grape: {
    fungal: [
      'Open the canopy to improve sunlight and airflow.',
      'Remove infected leaves or clusters when practical.',
      'Use a vineyard-specific spray program only after local expert confirmation.',
    ],
  },
};

// ── Generic Fallback Treatments ─────────────────────────────────────

const GENERIC_TREATMENTS = {
  fungal: [
    'Remove heavily infected leaves where practical.',
    'Reduce leaf wetness by watering near the soil.',
    'Ask a local agronomist before applying fungicide.',
  ],
  bacterial: [
    'Avoid splashing water from infected leaves to healthy leaves.',
    'Disinfect tools after working with affected plants.',
    'Confirm the diagnosis before using copper or antibiotic-based products.',
  ],
  viral: [
    'Remove severely affected plants if symptoms are spreading.',
    'Control insect vectors and weeds around the crop.',
    'Use certified clean seed or seedlings for the next crop cycle.',
  ],
  unknown: [
    'Inspect nearby plants and compare symptoms before treatment.',
    'Take another clear close-up photo if the result confidence is low.',
    'Ask a local agronomist before applying any pesticide.',
  ],
};

/**
 * Get treatment steps for a parsed label.
 *
 * @param {{ cropName: string, diseaseName: string, isHealthy: boolean, category: string }} label
 * @returns {string[]}
 */
export function getTreatmentSteps(label) {
  if (label.isHealthy) {
    return [
      'No disease treatment is recommended right now.',
      'Continue routine field monitoring.',
      'Maintain balanced irrigation and nutrition.',
    ];
  }

  const cropKey = label.cropName.toLowerCase().trim();
  const cropGuide = CROP_TREATMENT_GUIDES[cropKey] || {};
  return (
    cropGuide[label.category] ||
    GENERIC_TREATMENTS[label.category] ||
    GENERIC_TREATMENTS.unknown
  );
}

/**
 * Build a one-line treatment suggestion.
 *
 * @param {{ cropName: string, diseaseName: string, isHealthy: boolean, category: string }} label
 * @returns {string}
 */
export function buildTreatmentSuggestion(label) {
  if (label.isHealthy) {
    const cropContext =
      label.cropName === 'Unknown' ? '' : ` for ${label.cropName}`;
    return `No disease treatment is recommended${cropContext}. Keep monitoring and maintain good crop hygiene.`;
  }

  const steps = getTreatmentSteps(label);
  const cropContext =
    label.cropName === 'Unknown' ? 'this crop' : label.cropName;
  return (
    `For ${cropContext}, the model detected ${label.diseaseName}. ` +
    `${steps[0]} Confirm locally before applying chemical treatment.`
  );
}

/**
 * Build full farmer advice object matching the server's PredictionService output.
 *
 * @param {{ cropName: string, diseaseName: string, displayName: string, isHealthy: boolean, category: string }} label
 * @param {number} confidence
 * @returns {{
 *   severity: string,
 *   summary: string,
 *   treatment_suggestion: string,
 *   next_steps: string[],
 *   safety_note: string,
 *   crop_name: string,
 *   disease_category: string,
 * }}
 */
export function buildFarmerAdvice(label, confidence) {
  const treatmentSteps = getTreatmentSteps(label);

  if (label.isHealthy) {
    const summary =
      label.cropName !== 'Unknown'
        ? `The ${label.cropName.toLowerCase()} leaf looks healthy based on the current model prediction.`
        : 'The leaf looks healthy based on the current model prediction.';

    return {
      severity: 'none',
      summary,
      treatment_suggestion: buildTreatmentSuggestion(label),
      next_steps: [
        ...treatmentSteps,
        'Keep leaves dry when possible to reduce fungal risk.',
      ],
      safety_note:
        'This AI result is a screening tool. Recheck if symptoms appear later.',
      crop_name: label.cropName,
      disease_category: label.category,
    };
  }

  const severity = confidence >= 0.65 ? 'needs_attention' : 'uncertain';

  return {
    severity,
    summary: `The model detected signs that may match ${label.displayName}.`,
    treatment_suggestion: buildTreatmentSuggestion(label),
    next_steps: [
      'Inspect 5-10 nearby plants to see if symptoms are spreading.',
      ...treatmentSteps,
      'Ask a local agronomist before applying chemical pesticide or fungicide.',
    ],
    safety_note:
      'Use protective gear and follow label instructions for any chemical treatment.',
    crop_name: label.cropName,
    disease_category: label.category,
  };
}
