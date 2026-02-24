/**
 * Suggest EDT Tool
 * Intelligent EDT suggestion based on field name fuzzy matching
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { XppSymbolIndex } from '../metadata/symbolIndex.js';

interface SuggestEdtArgs {
  fieldName: string;
  context?: string;
  limit?: number;
}

export const suggestEdtTool: Tool = {
  name: 'suggest_edt',
  description: 'Suggest Extended Data Types (EDT) for a field name using fuzzy matching on indexed EDT metadata. Considers field name patterns, context, and common usage.',
  inputSchema: {
    type: 'object',
    properties: {
      fieldName: {
        type: 'string',
        description: 'Field name to suggest EDT for (e.g., "CustomerAccount", "OrderAmount", "TransDate")',
      },
      context: {
        type: 'string',
        description: 'Optional context (e.g., "sales order", "ledger journal") to improve suggestions',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of suggestions (default: 5)',
      },
    },
    required: ['fieldName'],
  },
};

export async function handleSuggestEdt(
  args: SuggestEdtArgs,
  symbolIndex: XppSymbolIndex
): Promise<any> {
  const { fieldName, context, limit = 5 } = args;

  console.log(`[suggestEdt] Suggesting EDT for field: ${fieldName}, context: ${context}`);

  const db = symbolIndex.db;

  // Strategy 1: Exact match on EDT name
  const exactMatch = db.prepare(`
    SELECT name, extends, enumType, referenceTable, label
    FROM edt_metadata
    WHERE name = ?
    LIMIT 1
  `).get(fieldName) as { name: string; extends: string; enumType: string; referenceTable: string; label: string } | undefined;

  if (exactMatch) {
    console.log(`[suggestEdt] Found exact EDT match: ${exactMatch.name}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            fieldName,
            suggestions: [
              {
                edt: exactMatch.name,
                confidence: 1.0,
                reason: 'Exact match on EDT name',
                extends: exactMatch.extends,
                enumType: exactMatch.enumType,
                referenceTable: exactMatch.referenceTable,
                label: exactMatch.label,
              },
            ],
          }, null, 2),
        },
      ],
    };
  }

  // Strategy 2: Fuzzy match on EDT name (case-insensitive, substring)
  const fuzzyMatches = db.prepare(`
    SELECT name, extends, enumType, referenceTable, label
    FROM edt_metadata
    WHERE name LIKE ? OR name LIKE ?
    ORDER BY LENGTH(name) ASC
    LIMIT ?
  `).all(`%${fieldName}%`, `%${fieldName.toLowerCase()}%`, limit * 2) as Array<{ name: string; extends: string; enumType: string; referenceTable: string; label: string }>;

  console.log(`[suggestEdt] Found ${fuzzyMatches.length} fuzzy matches`);

  // Strategy 3: Pattern-based heuristics
  const heuristicSuggestions = getHeuristicSuggestions(fieldName, context);

  // Merge and rank suggestions
  const suggestions: any[] = [];
  const seen = new Set<string>();

  // Add fuzzy matches with confidence score
  for (const match of fuzzyMatches) {
    if (seen.has(match.name)) continue;
    seen.add(match.name);

    const confidence = calculateConfidence(fieldName, match.name, context);
    suggestions.push({
      edt: match.name,
      confidence,
      reason: `Fuzzy match (similarity: ${Math.round(confidence * 100)}%)`,
      extends: match.extends,
      enumType: match.enumType,
      referenceTable: match.referenceTable,
      label: match.label,
    });
  }

  // Add heuristic suggestions
  for (const heuristic of heuristicSuggestions) {
    if (seen.has(heuristic.edt)) continue;
    seen.add(heuristic.edt);

    // Check if EDT exists
    const edtExists = db.prepare(`
      SELECT name, extends, enumType, referenceTable, label
      FROM edt_metadata
      WHERE name = ?
      LIMIT 1
    `).get(heuristic.edt) as { name: string; extends: string; enumType: string; referenceTable: string; label: string } | undefined;

    if (edtExists) {
      suggestions.push({
        edt: heuristic.edt,
        confidence: heuristic.confidence,
        reason: heuristic.reason,
        extends: edtExists.extends,
        enumType: edtExists.enumType,
        referenceTable: edtExists.referenceTable,
        label: edtExists.label,
      });
    }
  }

  // Sort by confidence (descending)
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // Limit results
  const topSuggestions = suggestions.slice(0, limit);

  console.log(`[suggestEdt] Returning ${topSuggestions.length} suggestions`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          fieldName,
          context,
          suggestions: topSuggestions,
        }, null, 2),
      },
    ],
  };
}

/**
 * Calculate confidence score based on string similarity
 */
function calculateConfidence(fieldName: string, edtName: string, context?: string): number {
  const field = fieldName.toLowerCase();
  const edt = edtName.toLowerCase();

  // Exact match
  if (field === edt) return 1.0;

  // EDT contains field name
  if (edt.includes(field)) {
    return 0.9 - (edt.length - field.length) * 0.01;
  }

  // Field name contains EDT
  if (field.includes(edt)) {
    return 0.8 - (field.length - edt.length) * 0.01;
  }

  // Levenshtein-based similarity
  const distance = levenshteinDistance(field, edt);
  const maxLength = Math.max(field.length, edt.length);
  const similarity = 1 - distance / maxLength;

  // Boost if context matches
  if (context && edt.includes(context.toLowerCase())) {
    return Math.min(similarity + 0.1, 1.0);
  }

  return Math.max(similarity, 0.3);
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Get heuristic EDT suggestions based on field name patterns
 */
function getHeuristicSuggestions(fieldName: string, context?: string): Array<{
  edt: string;
  confidence: number;
  reason: string;
}> {
  const nameLower = fieldName.toLowerCase();
  const suggestions: Array<{ edt: string; confidence: number; reason: string }> = [];

  // Common patterns
  const patterns: Array<[RegExp, string, string]> = [
    [/^recid$/i, 'RecId', 'Standard RecId field'],
    [/name/i, 'Name', 'Field contains "name"'],
    [/description|desc/i, 'Description', 'Field contains "description"'],
    [/amount/i, 'AmountMST', 'Field contains "amount"'],
    [/quantity|qty/i, 'Qty', 'Field contains "quantity"'],
    [/price/i, 'PriceUnit', 'Field contains "price"'],
    [/date/i, 'TransDate', 'Field contains "date"'],
    [/time|datetime/i, 'TransDateTime', 'Field contains "time"'],
    [/account/i, 'LedgerAccount', 'Field contains "account"'],
    [/customer|cust(?!om)/i, 'CustAccount', 'Field contains "customer"'],
    [/vendor|vend/i, 'VendAccount', 'Field contains "vendor"'],
    [/item/i, 'ItemId', 'Field contains "item"'],
    [/percent|pct/i, 'Percent', 'Field contains "percent"'],
    [/status/i, 'NoYesId', 'Field contains "status"'],
    [/enabled|active/i, 'NoYesId', 'Field contains "enabled/active"'],
    [/warehouse/i, 'InventLocationId', 'Field contains "warehouse"'],
    [/site/i, 'InventSiteId', 'Field contains "site"'],
    [/dimension/i, 'DimensionDefault', 'Field contains "dimension"'],
    [/currency/i, 'CurrencyCode', 'Field contains "currency"'],
    [/phone/i, 'Phone', 'Field contains "phone"'],
    [/email/i, 'Email', 'Field contains "email"'],
    [/address/i, 'AddressStreet', 'Field contains "address"'],
    [/id$/i, 'RefRecId', 'Field ends with "Id"'],
  ];

  for (const [pattern, edt, reason] of patterns) {
    if (pattern.test(nameLower)) {
      suggestions.push({
        edt,
        confidence: 0.85,
        reason,
      });
    }
  }

  // Context-based suggestions
  if (context) {
    const contextLower = context.toLowerCase();
    
    if (contextLower.includes('sales') || contextLower.includes('order')) {
      if (nameLower.includes('customer')) {
        suggestions.push({ edt: 'CustAccount', confidence: 0.9, reason: 'Context: sales/order' });
      }
      if (nameLower.includes('line')) {
        suggestions.push({ edt: 'LineNum', confidence: 0.85, reason: 'Context: sales/order lines' });
      }
    }

    if (contextLower.includes('inventory') || contextLower.includes('stock')) {
      if (nameLower.includes('location')) {
        suggestions.push({ edt: 'InventLocationId', confidence: 0.9, reason: 'Context: inventory' });
      }
      if (nameLower.includes('item')) {
        suggestions.push({ edt: 'ItemId', confidence: 0.9, reason: 'Context: inventory' });
      }
    }

    if (contextLower.includes('ledger') || contextLower.includes('journal')) {
      if (nameLower.includes('account')) {
        suggestions.push({ edt: 'LedgerAccount', confidence: 0.9, reason: 'Context: ledger/journal' });
      }
    }
  }

  return suggestions;
}
