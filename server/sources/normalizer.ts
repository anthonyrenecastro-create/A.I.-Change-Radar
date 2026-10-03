import { canonicalHash, sha256 } from '../utils/crypto';

export interface StructuredFacts {
  models?: string[];
  prices?: Array<{ model: string; inputPricePerMillion?: number; outputPricePerMillion?: number; unit?: string }>;
  deprecations?: Array<{ item: string; effectiveDate?: string; replacement?: string }>;
  policyStatements?: string[];
  effectiveDates?: string[];
}

export interface NormalizedSnapshot {
  rawContent: string;
  extractedText: string;
  structuredFacts: StructuredFacts;
  contentHash: string;
  substantiveHash: string;
}

/**
 * Strips cosmetic HTML, scripts, navigation, headers, and footers to extract clean substantive text.
 */
export function extractSubstantiveText(html: string): string {
  if (!html) return '';

  let text = html;

  // Remove script and style elements
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');

  // Remove navigation, header, footer, cookie banners
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ');
  text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ');
  text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');
  text = text.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ');

  // Replace common HTML tags with breaks
  text = text.replace(/<(?:p|div|tr|h1|h2|h3|h4|h5|h6|li|blockquote)[^>]*>/gi, '\n');
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' '); // remove all remaining tags

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Normalize whitespace: collapse multiple horizontal spaces, trim lines
  const lines = text
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0 && !isIgnoredCosmeticLine(line));

  return lines.join('\n');
}

/**
 * Helper to identify noisy lines like "Copyright 2026", "All rights reserved", page load timers.
 */
function isIgnoredCosmeticLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (lower.startsWith('copyright') || lower.includes('all rights reserved')) return true;
  if (lower.startsWith('last updated:') || lower.startsWith('page generated in')) return true;
  if (lower.includes('cdn refreshed') || lower.includes('session nonce') || lower.startsWith('banner:')) return true;
  if (lower === 'cookie settings' || lower === 'accept all cookies' || lower === 'privacy policy | terms of service') return true;
  if (/^\d{1,2}:\d{2}\s*(am|pm)/i.test(line)) return true;
  return false;
}

/**
 * Extracts substantive structured facts (models, prices, dates, policy points).
 */
export function extractStructuredFacts(text: string): StructuredFacts {
  const facts: StructuredFacts = {
    models: [],
    prices: [],
    deprecations: [],
    policyStatements: [],
    effectiveDates: [],
  };

  const lines = text.split('\n');

  // Detect common model identifiers
  const modelRegex = /\b(gpt-4o(?:-mini)?|gpt-4-turbo|gpt-4-0613|o1(?:-mini)?|o3-mini|claude-3-5-(?:sonnet|haiku)|claude-3-opus|gemini-2\.5-(?:flash|pro)|gemini-3\.8-(?:flash|pro)|mistral-(?:large|small|pixtral)|llama-3\.[123]-\d+b)\b/gi;
  const foundModels = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(text)) !== null) {
    foundModels.add(match[1].toLowerCase());
  }
  facts.models = Array.from(foundModels).sort();

  // Detect effective dates
  const dateRegex = /\b(?:effective|starting|retired on|deprecated as of)\s+([A-Z][a-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})\b/gi;
  while ((match = dateRegex.exec(text)) !== null) {
    facts.effectiveDates?.push(match[1]);
  }

  // Detect price patterns e.g. "$0.50 / 1M input tokens" or "$2.50 per 1M tokens"
  const priceRegex = /\$?(\d+\.\d{2})\s*(?:\/|per)\s*(?:1M|million)\s*(input|output)?\s*tokens?/gi;
  for (const line of lines) {
    if (line.toLowerCase().includes('price') || line.toLowerCase().includes('pricing') || line.toLowerCase().includes('token')) {
      while ((match = priceRegex.exec(line)) !== null) {
        const rate = parseFloat(match[1]);
        const type = match[2]?.toLowerCase() || 'tokens';
        facts.prices?.push({
          model: facts.models[0] || 'general',
          inputPricePerMillion: type === 'input' ? rate : undefined,
          outputPricePerMillion: type === 'output' ? rate : undefined,
          unit: '1M tokens',
        });
      }
    }

    if (line.toLowerCase().includes('deprecat') || line.toLowerCase().includes('sunset') || line.toLowerCase().includes('shut down')) {
      facts.deprecations?.push({
        item: line.slice(0, 140),
        effectiveDate: facts.effectiveDates?.[0],
      });
    }

    if (line.toLowerCase().includes('data retention') || line.toLowerCase().includes('train') || line.toLowerCase().includes('privacy') || line.toLowerCase().includes('security')) {
      if (line.length > 25 && line.length < 300) {
        facts.policyStatements?.push(line);
      }
    }
  }

  return facts;
}

/**
 * Normalizes raw snapshot payload into substantive text, structured facts, and canonical hashes.
 */
export function normalizeSnapshot(rawContent: string): NormalizedSnapshot {
  const extractedText = extractSubstantiveText(rawContent);
  const structuredFacts = extractStructuredFacts(extractedText);
  const contentHash = sha256(rawContent);
  const substantiveHash = canonicalHash({
    substantiveText: extractedText,
    facts: structuredFacts,
  });

  return {
    rawContent,
    extractedText,
    structuredFacts,
    contentHash,
    substantiveHash,
  };
}
