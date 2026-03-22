/**
 * Extension Strategy Advisor Tool
 * Recommends the correct D365FO extensibility mechanism for a given scenario,
 * preventing common mistakes like using CoC where a Business Event is needed.
 */

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { XppServerContext } from '../types/context.js';

// ─── Schema ─────────────────────────────────────────────────────────────────

const scenarioTypes = [
  'data-validation',
  'field-defaulting',
  'business-logic-change',
  'outbound-integration',
  'inbound-data',
  'ui-modification',
  'document-output',
  'number-sequence',
  'security-access',
  'batch-processing',
  'custom',
] as const;

const ExtensionStrategyArgsSchema = z.object({
  goal: z.string().describe(
    'What you want to achieve — e.g. "validate that SalesLine quantity is positive", ' +
    '"send order confirmation to external ERP", "add field to CustTable form"'
  ),
  objectName: z.string().optional().describe(
    'Target D365FO object if known — e.g. "SalesTable", "CustTable", "SalesFormLetter"'
  ),
  scenario: z.enum(scenarioTypes).optional().describe(
    'Scenario category (auto-detected from goal if omitted). One of: ' +
    scenarioTypes.join(', ')
  ),
});

export const extensionStrategyToolDefinition = {
  name: 'recommend_extension_strategy',
  description:
    'Recommends the best D365FO extensibility mechanism for a given scenario. ' +
    'Prevents common design mistakes (e.g. using CoC where a Business Event or delegate is appropriate). ' +
    'Returns: recommended mechanism, reasoning, risks, alternatives, and next MCP tool calls. ' +
    'Use BEFORE writing extension code to ensure the right approach.',
  inputSchema: ExtensionStrategyArgsSchema,
};

// ─── Decision Rules ─────────────────────────────────────────────────────────

interface StrategyRule {
  /** Short pattern ID */
  id: string;
  /** Scenario categories this rule applies to */
  scenarios: readonly string[];
  /** Keywords in the goal text that trigger this rule */
  goalKeywords: readonly string[];
  /** Recommended mechanism */
  mechanism: string;
  /** Why this mechanism is correct */
  reasoning: string;
  /** Risks / caveats with this approach */
  risks: readonly string[];
  /** Alternative mechanisms and when to prefer them */
  alternatives: readonly { mechanism: string; when: string }[];
  /** Suggested MCP tool calls to proceed */
  nextSteps: readonly string[];
  /** Anti-patterns: common wrong choices for this scenario */
  antiPatterns: readonly { wrong: string; why: string }[];
}

const STRATEGY_RULES: readonly StrategyRule[] = [
  // ── Data validation ───────────────────────────────────────────────────
  {
    id: 'validate-table-data',
    scenarios: ['data-validation'],
    goalKeywords: ['validate', 'validation', 'check', 'verify', 'must be', 'cannot be',
                   'not allowed', 'mandatory', 'required field', 'constraint'],
    mechanism: 'Table Event Handler (onValidatedWrite / onValidatingWrite)',
    reasoning:
      'Table data events fire consistently for ALL data entry paths (forms, services, data entities, batch). ' +
      'CoC on validateWrite() also works but couples you to the method signature. Events are loosely coupled.',
    risks: [
      'onValidatedWrite fires AFTER standard validation — your code sees the result but cannot prevent insert if standard already approved',
      'onValidatingWrite fires BEFORE — use this to reject; set args.parmValidateResult(false)',
      'Data entity imports may bypass form-level validation — table events are safer than form events',
    ],
    alternatives: [
      { mechanism: 'CoC on table.validateWrite()', when: 'You need access to the full method context or must call next() conditionally' },
      { mechanism: 'Form data source validateWrite()', when: 'Validation is UI-specific and should NOT apply to service/entity imports' },
    ],
    nextSteps: [
      'analyze_extension_points("TableName") — check available events and existing extensions',
      'find_event_handlers("TableName") — see if someone already handles the same event',
      'generate_code(pattern="event-handler") — generate the handler skeleton',
    ],
    antiPatterns: [
      { wrong: 'Business Event', why: 'Business Events are for outbound notifications, not validation logic' },
      { wrong: 'Data Entity validateWrite', why: 'Only fires for DMF/OData — misses form and X++ code paths' },
    ],
  },

  // ── Field defaulting / initialization ─────────────────────────────────
  {
    id: 'field-defaulting',
    scenarios: ['field-defaulting'],
    goalKeywords: ['default', 'initialize', 'init value', 'auto-fill', 'auto-populate',
                   'set default', 'prefill', 'initValue'],
    mechanism: 'Table Event Handler (onInitValue) or CoC on initValue()',
    reasoning:
      'initValue() is the standard entry point for field defaults on new records. ' +
      'The event variant (onInitValue / onInitializedRecord) fires after the kernel sets defaults.',
    risks: [
      'initValue only fires for new records — not on copy or data import',
      'If using CoC, always call next first so standard defaults are set before your logic',
    ],
    alternatives: [
      { mechanism: 'CoC on table.initValue()', when: 'You need to conditionally skip default logic or set values that depend on other defaulted fields' },
      { mechanism: 'Form data source initValue()', when: 'Default depends on form context (e.g. header record of a lines form)' },
    ],
    nextSteps: [
      'analyze_extension_points("TableName") — check initValue availability',
      'get_method_signature("TableName", "initValue", includeCocTemplate: true) — get CoC template',
    ],
    antiPatterns: [
      { wrong: 'Overriding insert()', why: 'insert() is for persistence — defaults belong in initValue()' },
      { wrong: 'Form init()', why: 'Form init runs once at form open, not per new record' },
    ],
  },

  // ── Business logic modification ───────────────────────────────────────
  {
    id: 'business-logic-change',
    scenarios: ['business-logic-change'],
    goalKeywords: ['modify', 'change behavior', 'add logic', 'extend', 'override',
                   'before posting', 'after posting', 'custom calculation', 'adjust',
                   'intercept', 'hook into'],
    mechanism: 'Chain of Command (CoC) on the target method',
    reasoning:
      'CoC wraps the original method. You call next() to execute the original and can add pre/post logic. ' +
      'This is the PRIMARY extensibility mechanism in D365FO for modifying existing business logic.',
    risks: [
      'CoC runs in the same transaction as the original — errors in your code roll back the entire operation',
      'Multiple CoC extensions on the same method run in undefined order unless you control model loading',
      'Replacing the return value of next() changes behavior for ALL callers — ensure correctness',
    ],
    alternatives: [
      { mechanism: 'Delegate / event handler', when: 'The class exposes a delegate at the exact extension point you need — prefer it over CoC for loose coupling' },
      { mechanism: 'Pre/post event handler', when: 'You only need to observe or react, not modify the core logic' },
      { mechanism: 'Replaceable method', when: 'Method is marked [Replaceable] — you can fully replace it (rare in standard app)' },
    ],
    nextSteps: [
      'analyze_extension_points("ClassName") — see CoC-eligible methods and delegates',
      'get_method_signature("ClassName", "methodName", includeCocTemplate: true) — get exact CoC skeleton',
      'find_coc_extensions("ClassName", "methodName") — check for existing CoC wrappers',
    ],
    antiPatterns: [
      { wrong: 'Copy-paste the entire class', why: 'Over-layering defeats the purpose of extensions and blocks upgrades' },
      { wrong: 'Business Event for internal logic', why: 'Business Events are async notifications — they cannot modify transactions' },
    ],
  },

  // ── Outbound integration ──────────────────────────────────────────────
  {
    id: 'outbound-integration',
    scenarios: ['outbound-integration'],
    goalKeywords: ['send to', 'notify', 'push', 'outbound', 'external system', 'integration',
                   'power automate', 'service bus', 'webhook', 'event grid', 'publish',
                   'trigger external', 'notify erp', 'sync to'],
    mechanism: 'Business Event',
    reasoning:
      'Business Events are the D365FO-native mechanism for outbound notifications. ' +
      'They integrate with Power Automate, Azure Service Bus, Event Grid, and HTTPS endpoints. ' +
      'They are async, decoupled from the transaction, and support payload contracts.',
    risks: [
      'Business Events fire AFTER commit — if the receiving system fails, D365FO transaction is already committed',
      'Payload must be a DataContract class — complex object graphs need flattening',
      'Event delivery is at-least-once — the consumer must be idempotent',
    ],
    alternatives: [
      { mechanism: 'Custom service (JSON/SOAP)', when: 'The external system must pull data on demand rather than react to events' },
      { mechanism: 'Data entity + OData', when: 'Integration requires CRUD operations, not event-driven notifications' },
      { mechanism: 'Dual-write', when: 'Real-time bidirectional sync with Dataverse is needed' },
    ],
    nextSteps: [
      'get_xpp_knowledge("business events") — learn the pattern',
      'generate_code(pattern="business-event", name="MyEvent") — generate skeleton',
    ],
    antiPatterns: [
      { wrong: 'CoC calling HttpClient', why: 'Synchronous HTTP in a transaction blocks the user and risks timeout/rollback' },
      { wrong: 'Data entity for event notification', why: 'Data entities are for CRUD — use Business Events for push notifications' },
      { wrong: 'Writing to an integration table', why: 'Polling tables are fragile — Business Events provide guaranteed delivery with retry' },
    ],
  },

  // ── Inbound data / external data transfer ─────────────────────────────
  {
    id: 'inbound-data',
    scenarios: ['inbound-data'],
    goalKeywords: ['import', 'inbound', 'receive', 'data entity', 'odata', 'dmf', 'dixf',
                   'data migration', 'bulk load', 'external data', 'api endpoint',
                   'rest api', 'soap service', 'pull data'],
    mechanism: 'Data Entity (+ optional custom service)',
    reasoning:
      'Data entities are the standard D365FO interface for inbound data. ' +
      'They support OData REST, DMF batch import, Dual-write, and recurring integrations. ' +
      'Custom services (JSON/SOAP) complement entities for complex multi-step operations.',
    risks: [
      'Data entity validation differs from form validation — test both paths',
      'DMF set-based operations may bypass row-level validateWrite — use entity-level validation',
      'High-volume imports should use DMF recurring integration, not OData per-record calls',
    ],
    alternatives: [
      { mechanism: 'Custom service class', when: 'The operation is complex (multi-table, conditional) and does not map to a single entity' },
      { mechanism: 'Dual-write', when: 'Real-time bidirectional sync with Dataverse tables' },
      { mechanism: 'Composite entity', when: 'Header + lines structure needs to be imported as a document' },
    ],
    nextSteps: [
      'get_xpp_knowledge("data-management-framework") — learn DMF patterns',
      'search("MyTable", "data-entity") — check if an entity already exists',
      'generate_code(pattern="data-entity", name="MyEntity") — generate entity skeleton',
    ],
    antiPatterns: [
      { wrong: 'Direct table insert via custom endpoint', why: 'Bypasses validation, number sequences, and event handlers' },
      { wrong: 'Business Event for inbound', why: 'Business Events are outbound-only — they push FROM D365FO, not into it' },
    ],
  },

  // ── UI modification ───────────────────────────────────────────────────
  {
    id: 'ui-modification',
    scenarios: ['ui-modification'],
    goalKeywords: ['form', 'ui', 'add field', 'add button', 'add tab', 'hide control',
                   'visible', 'enable', 'disable', 'lookup', 'form extension',
                   'display method', 'menu item', 'action pane', 'dialog'],
    mechanism: 'Form Extension (+ form extension class for logic)',
    reasoning:
      'Form extensions modify the UI declaratively (add controls, change properties) without touching the base form. ' +
      'For logic (button clicks, data source overrides), use extension classes with [ExtensionOf(formStr(...))].',
    risks: [
      'Control names in extensions must be unique across ALL extensions of the same form',
      'Cannot remove or reorder existing controls — only add, hide (Visible=No), or move to different groups',
      'Form extension classes see only public/protected form methods — private methods are inaccessible',
    ],
    alternatives: [
      { mechanism: 'CoC on form method', when: 'Need to modify existing form logic (e.g. init, close, active record change)' },
      { mechanism: 'Display/edit method on table extension', when: 'Computed field shown on multiple forms — put it on the table, not the form' },
      { mechanism: 'New standalone form', when: 'The change is too large for an extension (new document type, new workspace)' },
    ],
    nextSteps: [
      'get_form_info("FormName", searchControl="General") — find exact control names and hierarchy',
      'analyze_extension_points("FormName") — check form extension points',
      'create_d365fo_file(objectType="form-extension") — create the extension',
    ],
    antiPatterns: [
      { wrong: 'Overlayering the base form', why: 'Overlayering is not supported in D365FO — use extensions only' },
      { wrong: 'CoC to add controls', why: 'Controls should be added declaratively in form extension XML, not built in code' },
    ],
  },

  // ── Document output / printing ────────────────────────────────────────
  {
    id: 'document-output',
    scenarios: ['document-output'],
    goalKeywords: ['report', 'print', 'ssrs', 'pdf', 'document', 'invoice', 'packing slip',
                   'er', 'electronic reporting', 'output', 'format', 'template',
                   'business document', 'label print', 'excel'],
    mechanism: 'Electronic Reporting (ER) or SSRS Report Extension',
    reasoning:
      'ER is the strategic direction for business documents (invoices, statements). ' +
      'It supports runtime-editable templates (Word, Excel, PDF) without developer deployment. ' +
      'SSRS reports are still used for operational/internal reports with complex data processing.',
    risks: [
      'ER requires a configuration provider and Dataverse model-mapping — setup cost is higher than SSRS',
      'SSRS report extensions can only add fields — they cannot remove standard fields from the design',
      'If the standard report is ER-based, extend the ER configuration — not the SSRS report',
    ],
    alternatives: [
      { mechanism: 'SSRS report (new)', when: 'Operational internal report with complex DP class logic' },
      { mechanism: 'ER format extension', when: 'Modifying an existing ER-based document (invoice, statement)' },
      { mechanism: 'Report DP extension', when: 'Adding fields to an existing SSRS temp table via table extension + DP CoC' },
    ],
    nextSteps: [
      'get_report_info("ReportName") — inspect existing report structure',
      'get_xpp_knowledge("ssrs-reports") — patterns for SSRS',
      'generate_smart_report(name="MyReport") — generate full SSRS stack',
    ],
    antiPatterns: [
      { wrong: 'Business Event for document delivery', why: 'Business Events send notifications, not formatted documents' },
      { wrong: 'Custom SSRS to replace an ER document', why: 'If standard uses ER, extend the ER config — SSRS won\'t integrate with document routing' },
    ],
  },

  // ── Number sequence ───────────────────────────────────────────────────
  {
    id: 'number-sequence',
    scenarios: ['number-sequence'],
    goalKeywords: ['number sequence', 'auto number', 'sequence', 'voucher', 'numbering',
                   'document number', 'auto-increment'],
    mechanism: 'Number Sequence framework (NumberSeqModule + EDT + parameter form)',
    reasoning:
      'D365FO number sequences are configured per legal entity/company. ' +
      'They require: EDT with NumberSequenceGroup, NumberSeqModule subclass, parameter table reference, and loadModule() registration.',
    risks: [
      'Number sequence must be set up in each legal entity — missing setup causes runtime error',
      'Continuous sequences block concurrent transactions — use non-continuous unless legally required',
    ],
    alternatives: [
      { mechanism: 'Custom counter table', when: 'Simple auto-increment without legal entity scope or configurable format (rare — prefer the framework)' },
    ],
    nextSteps: [
      'get_xpp_knowledge("number-sequences") — full pattern reference',
      'generate_code(pattern="number-seq-handler") — generate skeleton',
    ],
    antiPatterns: [
      { wrong: 'Identity column / RecId as business number', why: 'RecId is internal — users need formatted, gapless (or configurable) business numbers' },
      { wrong: 'Max+1 from table', why: 'Race condition under concurrency — number sequence framework handles locking correctly' },
    ],
  },

  // ── Security / access control ─────────────────────────────────────────
  {
    id: 'security-access',
    scenarios: ['security-access'],
    goalKeywords: ['security', 'privilege', 'duty', 'role', 'permission', 'access',
                   'menu item', 'grant', 'restrict', 'authorize'],
    mechanism: 'Security Privilege + Duty + Role (AOT objects)',
    reasoning:
      'D365FO security follows a strict hierarchy: Menu Item → Privilege → Duty → Role. ' +
      'Custom features need at least a Privilege (grants access to an entry point) and typically a Duty (groups related privileges). ' +
      'Roles are assigned to users.',
    risks: [
      'Privileges are per-entry-point (menu item, web content, service) — not per table or field directly',
      'Table permissions inherit via menu item → privilege chain — broken chain = no access',
      'Extensible enums for duty/privilege discovery: use get_security_coverage_for_object to verify the chain',
    ],
    alternatives: [
      { mechanism: 'Security policy (XDS)', when: 'Row-level security is needed (e.g. filter CustTable by user\'s allowed customers)' },
      { mechanism: 'Table permission framework override', when: 'Granting DML access without a menu item entry point (rare)' },
    ],
    nextSteps: [
      'get_xpp_knowledge("security-privileges-duties") — security pattern reference',
      'get_security_coverage_for_object("ObjectName") — check existing security chain',
      'create_d365fo_file(objectType="security-privilege") — create privilege',
    ],
    antiPatterns: [
      { wrong: 'Hardcoded hasPermission() checks', why: 'Use the declarative security model — privilege chain enforced by the kernel' },
      { wrong: 'Global::infolog for access denied', why: 'Throw error with specific message; the security framework handles denial automatically for menu items' },
    ],
  },

  // ── Batch processing ──────────────────────────────────────────────────
  {
    id: 'batch-processing',
    scenarios: ['batch-processing'],
    goalKeywords: ['batch', 'scheduled', 'background', 'recurring', 'async processing',
                   'batch job', 'sysoperation', 'runbase'],
    mechanism: 'SysOperation framework (preferred) or RunBaseBatch',
    reasoning:
      'SysOperation separates contract (parameters), controller (scheduling), and service (execution). ' +
      'It supports reliable async processing via the batch framework with retries and alerts.',
    risks: [
      'RunBase is legacy but still functional — use SysOperation for new development',
      'Batch tasks run under the batch service account unless "Run as user" is configured',
      'SysOperation contracts must be [DataContract] with [DataMember] — plain class members are lost during serialization',
    ],
    alternatives: [
      { mechanism: 'RunBaseBatch', when: 'Simple one-off jobs or extending existing RunBase-based processes' },
      { mechanism: 'Business Event + external processor', when: 'Processing should happen outside D365FO (e.g. Azure Function)' },
    ],
    nextSteps: [
      'get_xpp_knowledge("sysoperation") — SysOperation patterns',
      'generate_code(pattern="sysoperation", name="MyProcess") — generate SysOperation skeleton',
      'generate_code(pattern="batch-job", name="MyBatch") — generate RunBaseBatch skeleton',
    ],
    antiPatterns: [
      { wrong: 'Thread.Sleep / while-polling in batch', why: 'Use batch recurrence and alerts — polling wastes AOS resources' },
      { wrong: 'Synchronous long-running operation on form', why: 'Operations > 5s should be batch-scheduled, not blocking the UI' },
    ],
  },
];

// ─── Scenario Auto-Detection ────────────────────────────────────────────────

function detectScenario(goal: string): typeof scenarioTypes[number] | undefined {
  const lower = goal.toLowerCase();

  const scenarioKeywordMap: { scenario: typeof scenarioTypes[number]; keywords: string[] }[] = [
    { scenario: 'data-validation', keywords: ['validat', 'check', 'verify', 'must be', 'cannot be', 'not allowed', 'mandatory', 'required field', 'constraint'] },
    { scenario: 'field-defaulting', keywords: ['default', 'init value', 'auto-fill', 'prefill', 'auto-populate', 'initvalue'] },
    { scenario: 'outbound-integration', keywords: ['send to', 'notify external', 'push to', 'outbound', 'power automate', 'service bus', 'webhook', 'event grid', 'publish event'] },
    { scenario: 'inbound-data', keywords: ['import', 'inbound', 'data entity', 'odata', 'dmf', 'dixf', 'data migration', 'bulk load', 'rest api'] },
    { scenario: 'ui-modification', keywords: ['form', 'add field', 'add button', 'add tab', 'hide control', 'lookup', 'display method', 'dialog', 'action pane'] },
    { scenario: 'document-output', keywords: ['report', 'print', 'ssrs', 'pdf', 'electronic reporting', 'er format', 'invoice print', 'packing slip', 'business document'] },
    { scenario: 'number-sequence', keywords: ['number sequence', 'auto number', 'voucher numbering', 'document number'] },
    { scenario: 'security-access', keywords: ['privilege', 'duty', 'role', 'security', 'access control', 'permission', 'authorize'] },
    { scenario: 'batch-processing', keywords: ['batch job', 'scheduled', 'background process', 'recurring', 'sysoperation', 'runbase'] },
    { scenario: 'business-logic-change', keywords: ['modify', 'change behavior', 'add logic', 'extend method', 'before posting', 'after posting', 'intercept', 'hook into', 'override'] },
  ];

  // Score each scenario by matching keywords
  let best: { scenario: typeof scenarioTypes[number]; score: number } | undefined;
  for (const entry of scenarioKeywordMap) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { scenario: entry.scenario, score };
    }
  }
  return best?.scenario;
}

// ─── Rule Matching ──────────────────────────────────────────────────────────

function findMatchingRules(goal: string, scenario?: string): StrategyRule[] {
  const lower = goal.toLowerCase();

  // 1) Filter by scenario if provided
  let candidates = scenario
    ? STRATEGY_RULES.filter(r => r.scenarios.includes(scenario))
    : [...STRATEGY_RULES];

  // 2) Score each rule by keyword match on the goal
  const scored = candidates.map(rule => {
    let score = 0;
    for (const kw of rule.goalKeywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    // Boost if scenario matches explicitly
    if (scenario && rule.scenarios.includes(scenario)) score += 3;
    return { rule, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top match + any close alternatives (score > 0)
  return scored.filter(s => s.score > 0).map(s => s.rule);
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function formatRecommendation(
  goal: string,
  resolvedScenario: string,
  primary: StrategyRule,
  alternatives: StrategyRule[],
  objectName?: string,
): string {
  let out = `# Extension Strategy Recommendation\n\n`;
  out += `**Goal:** ${goal}\n`;
  if (objectName) out += `**Target object:** ${objectName}\n`;
  out += `**Detected scenario:** ${resolvedScenario}\n\n`;

  out += `## ✅ Recommended: ${primary.mechanism}\n\n`;
  out += `**Why:** ${primary.reasoning}\n\n`;

  if (primary.risks.length > 0) {
    out += `### ⚠️ Risks & Caveats\n\n`;
    for (const risk of primary.risks) {
      out += `- ${risk}\n`;
    }
    out += '\n';
  }

  if (primary.alternatives.length > 0) {
    out += `### 🔄 Alternatives\n\n`;
    for (const alt of primary.alternatives) {
      out += `- **${alt.mechanism}** — ${alt.when}\n`;
    }
    out += '\n';
  }

  if (primary.antiPatterns.length > 0) {
    out += `### ❌ Anti-Patterns (Do NOT Use)\n\n`;
    for (const ap of primary.antiPatterns) {
      out += `- **${ap.wrong}** — ${ap.why}\n`;
    }
    out += '\n';
  }

  out += `### 🚀 Next Steps\n\n`;
  for (const step of primary.nextSteps) {
    const stepWithObject = objectName
      ? step.replace(/"(ClassName|TableName|FormName|ObjectName|ReportName)"/g, `"${objectName}"`)
      : step;
    out += `1. \`${stepWithObject}\`\n`;
  }
  out += '\n';

  // Show secondary matches as brief alternatives
  if (alternatives.length > 0) {
    out += `## Other Potentially Applicable Strategies\n\n`;
    for (const alt of alternatives.slice(0, 2)) {
      out += `- **${alt.mechanism}** (scenario: ${alt.scenarios.join(', ')})\n`;
    }
    out += '\n';
  }

  return out;
}

function formatNoMatch(goal: string, objectName?: string): string {
  let out = `# Extension Strategy Recommendation\n\n`;
  out += `**Goal:** ${goal}\n`;
  if (objectName) out += `**Target object:** ${objectName}\n\n`;
  out += `Could not auto-detect the best extensibility mechanism from the goal description.\n\n`;
  out += `**Try specifying the \`scenario\` parameter explicitly.** Available scenarios:\n\n`;
  for (const s of scenarioTypes) {
    out += `- \`${s}\`\n`;
  }
  out += `\n**General guidance:**\n\n`;
  out += `| Goal | Mechanism |\n|------|----------|\n`;
  out += `| Validate data | Table event (onValidatedWrite) or CoC on validateWrite() |\n`;
  out += `| Default field values | Table event (onInitValue) or CoC on initValue() |\n`;
  out += `| Modify business logic | Chain of Command (CoC) |\n`;
  out += `| Send notification to external system | Business Event |\n`;
  out += `| Receive/import external data | Data Entity (OData/DMF) |\n`;
  out += `| Add field/button to form | Form Extension |\n`;
  out += `| Print document / report | ER configuration or SSRS report |\n`;
  out += `| Auto-numbering | Number Sequence framework |\n`;
  out += `| Control user access | Security Privilege → Duty → Role |\n`;
  out += `| Background / scheduled processing | SysOperation framework |\n`;
  return out;
}

// ─── Tool Handler ───────────────────────────────────────────────────────────

export async function extensionStrategyAdvisorTool(
  request: CallToolRequest,
  _context: XppServerContext,
) {
  try {
    const args = ExtensionStrategyArgsSchema.parse(request.params.arguments);
    const { goal, objectName } = args;

    // Resolve scenario: explicit > auto-detected
    const resolvedScenario = args.scenario ?? detectScenario(goal) ?? 'custom';
    const matchedRules = findMatchingRules(goal, resolvedScenario !== 'custom' ? resolvedScenario : undefined);

    if (matchedRules.length === 0) {
      return {
        content: [{ type: 'text' as const, text: formatNoMatch(goal, objectName) }],
        isError: false,
      };
    }

    const primary = matchedRules[0];
    const secondaryAlternatives = matchedRules.slice(1);

    return {
      content: [{
        type: 'text' as const,
        text: formatRecommendation(goal, resolvedScenario, primary, secondaryAlternatives, objectName),
      }],
      isError: false,
    };
  } catch (error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Error in extension strategy advisor: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}
