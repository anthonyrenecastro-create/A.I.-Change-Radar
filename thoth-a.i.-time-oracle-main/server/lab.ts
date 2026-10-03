import type { Express } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * Legacy HRM Ecology research lab endpoints. Mounted only when ENABLE_LAB is true
 * (default: development only). They are unauthenticated and spend Gemini quota,
 * so they must stay off in production.
 */
export function mountLab(app: Express): void {
  // Shared Gemini Client Instance
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // 1. Health Endpoint
  app.get('/api/lab/health', (req, res) => {
    res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY), timestamp: Date.now() });
  });

  // 2. LLM A: Reasoning Engine Endpoint
  app.post('/api/lab/gemini/reason', async (req, res) => {
    try {
      const { worldStateSummary, userPrompt } = req.body;

      if (!ai) {
        // Fallback response if key is missing
        return res.json({
          llmSource: 'heuristic_fallback',
          rationale: '[Fallback Reasoning] API Key not detected; executing local heuristic substrate adaptation.',
          confidence: 0.85,
          activationStrength: 0.75,
          fieldDeltas: {},
          cognitiveFocusNodeId: worldStateSummary?.attentionFocusNodeId || 'node_0',
          strategicGoalAdjustment: userPrompt ? `Orient toward: ${userPrompt}` : null,
          proposedEvents: [],
        });
      }

      const systemInstruction = `
  You are LLM A (Reasoning Engine) inside an HRM (Hierarchical Resilient Model) World-Model Substrate.
  Your function is general intelligence reasoning operating over the substrate's perception, memory, goals, uncertainty, and topology.
  Analyze the current world state and user input, then output strategic reasoning proposals, target field deltas, cognitive focus shifts, and structural adaptation events.
  Respond strictly in JSON format.
  `;

      const prompt = `
  Current World State Summary:
  - Step: ${worldStateSummary?.step ?? 0}
  - Active Goal: ${worldStateSummary?.activeGoal ?? 'Maintain World Model Stability'}
  - Focus Node: ${worldStateSummary?.attentionFocusNodeId ?? 'node_0'}
  - Global Stress: ${worldStateSummary?.globalStress ?? 0.1}
  - Global Entropy / Uncertainty: ${worldStateSummary?.globalEntropy ?? 0.1}
  - Active Nodes Count: ${worldStateSummary?.nodeCount ?? 12}
  - Sensed Nodes / Observation: ${JSON.stringify(worldStateSummary?.observation || {})}
  ${userPrompt ? `- User Directive / Sensor Trigger: "${userPrompt}"` : ''}

  Generate structured reasoning proposal with fieldDeltas, strategic goal adjustment, focus node, and proposed events.
  `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: { type: Type.STRING, description: 'Strategic reasoning summary' },
              confidence: { type: Type.NUMBER, description: 'Confidence score between 0 and 1' },
              activationStrength: { type: Type.NUMBER, description: 'Activation strength between 0 and 1' },
              cognitiveFocusNodeId: { type: Type.STRING, description: 'Target node ID for attention focus' },
              strategicGoalAdjustment: { type: Type.STRING, description: 'Updated active goal or strategy' },
              fieldDeltas: {
                type: Type.OBJECT,
                description: 'Proposed scalar field delta per nodeId e.g. {"node_0": 0.1, "node_1": -0.05}',
              },
              proposedEvents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: 'e.g. EdgeHealing, SplitRegion, AddNode, AddEdge' },
                    targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reason: { type: Type.STRING },
                  },
                  required: ['type', 'reason'],
                },
              },
            },
            required: ['rationale', 'confidence', 'activationStrength'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        llmSource: 'gemini-3.6-flash',
        ...parsed,
      });
    } catch (error: any) {
      console.error('LLM A Reasoning Error:', error);
      res.status(500).json({
        error: error.message || 'LLM A Reasoning Failure',
        llmSource: 'error_fallback',
        rationale: `Error calling Gemini reasoning engine: ${error.message}. Substrate reverting to safety fallback.`,
        confidence: 0.5,
        activationStrength: 0.3,
      });
    }
  });

  // 3. LLM B: Critique & Reflector Endpoint
  app.post('/api/lab/gemini/critique', async (req, res) => {
    try {
      const { worldStateSummary, proposals } = req.body;

      if (!ai) {
        return res.json({
          llmSource: 'heuristic_fallback',
          critiqueRationale: '[Fallback Critique] Safe mode verified; baseline mechanism weights accepted.',
          overallConsistencyScore: 0.92,
          hallucinationRisk: 0.05,
          mechanismWeightAdjustments: {},
          vetoedMechanisms: [],
          safetyWarnings: [],
        });
      }

      const systemInstruction = `
  You are LLM B (Critique & Reflector) in an HRM World-Model Substrate.
  Your role is adversarial critique, contradiction detection, hallucination and entropy auditing, and safety/consistency verification before mechanism arbitration.
  Review the world state and mechanism proposals (from LLM A, deterministic tools, and sensors), evaluate consistency and conservation, and return weight adjustments or safety warnings.
  Respond strictly in JSON format.
  `;

      const prompt = `
  World State Context:
  - Step: ${worldStateSummary?.step ?? 0}
  - Global Stress: ${worldStateSummary?.globalStress ?? 0.1}
  - Global Entropy: ${worldStateSummary?.globalEntropy ?? 0.1}

  Active Proposals To Critique:
  ${JSON.stringify(proposals || [], null, 2)}

  Provide critique evaluation and mechanism weight adjustments.
  `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              critiqueRationale: { type: Type.STRING, description: 'Critique and consistency audit findings' },
              overallConsistencyScore: { type: Type.NUMBER, description: 'Substrate consistency score [0, 1]' },
              hallucinationRisk: { type: Type.NUMBER, description: 'Estimated hallucination/entropy risk [0, 1]' },
              vetoedMechanisms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of mechanism IDs to veto or disable for this step due to safety/contradiction',
              },
              safetyWarnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              mechanismWeightAdjustments: {
                type: Type.OBJECT,
                description: 'Multipliers for mechanism confidence e.g. {"mech_llm_reasoning": 1.1, "mech_diffusion": 0.9}',
              },
            },
            required: ['critiqueRationale', 'overallConsistencyScore', 'hallucinationRisk'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        llmSource: 'gemini-3.6-flash',
        ...parsed,
      });
    } catch (error: any) {
      console.error('LLM B Critique Error:', error);
      res.status(500).json({
        error: error.message || 'LLM B Critique Failure',
        llmSource: 'error_fallback',
        critiqueRationale: `Critique service encounter exception: ${error.message}. Standard safety bounds enforced.`,
        overallConsistencyScore: 0.7,
        hallucinationRisk: 0.2,
        vetoedMechanisms: [],
        safetyWarnings: ['LLM B critique pipeline unavailable; default safety bounds active.'],
      });
    }
  });

  // 4. Interactive Full Orchestration Endpoint
  app.post('/api/lab/gemini/interact', async (req, res) => {
    try {
      const { userPrompt, worldStateSummary } = req.body;

      if (!ai) {
        return res.json({
          llmSource: 'heuristic_fallback',
          llmA: {
            rationale: `[Substrate Action] Simulated response for prompt: "${userPrompt}". Modifying substrate attractor field.`,
            confidence: 0.88,
            activationStrength: 0.9,
            cognitiveFocusNodeId: 'node_1',
            strategicGoalAdjustment: userPrompt,
            fieldDeltas: { node_0: 0.2, node_1: 0.4 },
            proposedEvents: [],
          },
          llmB: {
            critiqueRationale: 'Substrate input within safety bounds. Verified energy budget.',
            overallConsistencyScore: 0.95,
            hallucinationRisk: 0.03,
            safetyWarnings: [],
          },
          toolActionsExecuted: ['Attractor Field Alignment', 'Memory Salience Boost'],
        });
      }

      const systemInstruction = `
  You are the General Intelligence Orchestrator for the HRM Ecology Substrate.
  When a user or environment input is received:
  1. LLM A generates strategic reasoning, target node focus, and substrate field deltas.
  2. LLM B critiques LLM A's proposals and evaluates risk & safety.
  3. Relevant Tool actions are selected for substrate mutation.

  Output JSON matching the exact schema.
  `;

      const prompt = `
  User Input Directive: "${userPrompt}"
  Substrate State:
  - Step: ${worldStateSummary?.step ?? 0}
  - Active Goal: ${worldStateSummary?.activeGoal ?? 'Maintain World Model Stability'}
  - Focus Node: ${worldStateSummary?.attentionFocusNodeId ?? 'node_0'}
  - Stress: ${worldStateSummary?.globalStress ?? 0.1}
  - Entropy: ${worldStateSummary?.globalEntropy ?? 0.1}

  Perform full Tri-Path Orchestration (LLM A reasoning, LLM B critique, Tool Actions).
  `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              llmA: {
                type: Type.OBJECT,
                properties: {
                  rationale: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  activationStrength: { type: Type.NUMBER },
                  cognitiveFocusNodeId: { type: Type.STRING },
                  strategicGoalAdjustment: { type: Type.STRING },
                  fieldDeltas: { type: Type.OBJECT },
                  proposedEvents: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING },
                        targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                        reason: { type: Type.STRING },
                      },
                    },
                  },
                },
                required: ['rationale', 'confidence'],
              },
              llmB: {
                type: Type.OBJECT,
                properties: {
                  critiqueRationale: { type: Type.STRING },
                  overallConsistencyScore: { type: Type.NUMBER },
                  hallucinationRisk: { type: Type.NUMBER },
                  safetyWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['critiqueRationale', 'overallConsistencyScore'],
              },
              toolActionsExecuted: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['llmA', 'llmB', 'toolActionsExecuted'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        llmSource: 'gemini-3.6-flash',
        ...parsed,
      });
    } catch (error: any) {
      console.error('Interact Error:', error);
      res.status(500).json({ error: error.message || 'Interact Failure' });
    }
  });
}
