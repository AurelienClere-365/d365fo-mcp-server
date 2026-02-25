/**
 * X++ Code Generation Tool
 * Generate X++ code templates for common patterns
 */

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { resolveObjectPrefix, applyObjectPrefix } from '../utils/modelClassifier.js';
import { getConfigManager } from '../utils/configManager.js';

const CodeGenArgsSchema = z.object({
  pattern: z
    .enum(['class', 'runnable', 'form-handler', 'data-entity', 'batch-job', 'table-extension'])
    .describe('Code pattern to generate'),
  name: z.string().describe(
    'For NEW objects (class, runnable, data-entity, batch-job): the object name WITHOUT prefix — prefix is auto-applied from EXTENSION_PREFIX env var or modelName. ' +
    'For EXTENSIONS (table-extension, form-handler): the BASE element name to extend (e.g. "CustTable", "SalesTable").'
  ),
  modelName: z.string().optional().describe(
    'Model/solution prefix used to derive the naming infix when EXTENSION_PREFIX is not set (e.g. "AslCore"). ' +
    'Required for extension patterns when EXTENSION_PREFIX is not configured.'
  ),
});

// Templates for NEW elements: (name already includes prefix)
const newElementTemplates: Record<string, (name: string) => string> = {
  class: (name) => `
/// <summary>
/// ${name} class
/// </summary>
public class ${name}
{
    public void run()
    {
        // TODO: Implement
    }
}`,

  runnable: (name) => `
/// <summary>
/// Runnable class ${name}
/// </summary>
internal final class ${name}
{
    /// <summary>
    /// Entry point
    /// </summary>
    public static void main(Args _args)
    {
        ${name} instance = new ${name}();
        instance.run();
    }

    /// <summary>
    /// Run method
    /// </summary>
    public void run()
    {
        // TODO: Implement logic
        info(strFmt("Executing %1", classStr(${name})));
    }
}`,

  'data-entity': (name) => `
/// <summary>
/// Data entity for ${name}
/// </summary>
public class ${name}Entity extends common
{
    /// <summary>
    /// Find entity by RecId
    /// </summary>
    /// <param name="_recId">Record ID</param>
    /// <param name="_forUpdate">Select for update</param>
    /// <returns>Entity instance</returns>
    public static ${name}Entity find(RecId _recId, boolean _forUpdate = false)
    {
        ${name}Entity entity;

        entity.selectForUpdate(_forUpdate);

        select firstonly entity
            where entity.RecId == _recId;

        return entity;
    }

    /// <summary>
    /// Validate entity
    /// </summary>
    /// <returns>True if valid</returns>
    public boolean validateWrite()
    {
        boolean ret = super();

        // TODO: Add custom validation

        return ret;
    }
}`,

  'batch-job': (name) => `
/// <summary>
/// Batch job controller for ${name}
/// </summary>
class ${name}Controller extends SysOperationServiceController
{
    /// <summary>
    /// Entry point
    /// </summary>
    public static void main(Args _args)
    {
        ${name}Controller controller = new ${name}Controller();
        controller.parmArgs(_args);
        controller.parmDialogCaption("${name}");
        controller.startOperation();
    }

    /// <summary>
    /// Constructor
    /// </summary>
    protected void new()
    {
        super();
        this.parmClassName(classStr(${name}Service));
        this.parmMethodName(methodStr(${name}Service, process));
    }

    /// <summary>
    /// Pack settings
    /// </summary>
    public container pack()
    {
        return [#CurrentVersion, #CurrentList];
    }

    /// <summary>
    /// Unpack settings
    /// </summary>
    public boolean unpack(container _packedClass)
    {
        return true;
    }
}

/// <summary>
/// Batch job service for ${name}
/// </summary>
class ${name}Service extends SysOperationServiceBase
{
    /// <summary>
    /// Process batch job
    /// </summary>
    public void process()
    {
        // TODO: Implement batch processing logic
        ttsbegin;

        // Your logic here

        ttscommit;

        info(strFmt("${name} completed successfully"));
    }
}`,
};

// Templates for EXTENSION elements: (baseName = element being extended, prefix = model/ISV infix)
// Naming rules per https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/extensibility/naming-guidelines-extensions:
//   table-extension class : {BaseTable}{Prefix}_Extension   (e.g. CustTableWHS_Extension)
//   form-handler class    : {BaseForm}{Prefix}Form_Extension (e.g. SalesTableWHSForm_Extension)

function formHandlerTemplate(baseName: string, prefix: string): string {
  // Class name: {BaseForm}{Prefix}Form_Extension
  const className = baseName + prefix + 'Form_Extension';
  return `
/// <summary>
/// Form extension class for ${baseName} (prefix: ${prefix})
/// Naming: {BaseForm}{Prefix}Form_Extension per MS naming guidelines
/// </summary>
[ExtensionOf(formStr(${baseName}))]
final class ${className}
{
    /// <summary>
    /// Form initialization
    /// </summary>
    public void init()
    {
        next init();
        // TODO: Add custom initialization logic
    }

    /// <summary>
    /// Form close
    /// </summary>
    public void close()
    {
        // TODO: Add cleanup logic
        next close();
    }

    /// <summary>
    /// Data source active event handler
    /// </summary>
    [FormDataSourceEventHandler(formDataSourceStr(${baseName}, DataSourceName), FormDataSourceEventType::Activated)]
    public static void DataSourceName_OnActivated(FormDataSource sender, FormDataSourceEventArgs e)
    {
        // TODO: Handle data source activation
    }
}`;
}

function tableExtensionTemplate(baseName: string, prefix: string): string {
  // Class name: {BaseTable}{Prefix}_Extension
  const className = baseName + prefix + '_Extension';
  return `
/// <summary>
/// Table extension class for ${baseName} (prefix: ${prefix})
/// Naming: {BaseTable}{Prefix}_Extension per MS naming guidelines
/// </summary>
[ExtensionOf(tableStr(${baseName}))]
final class ${className}
{
    /// <summary>
    /// Validate write
    /// </summary>
    public boolean validateWrite()
    {
        boolean ret = next validateWrite();

        // TODO: Add custom validation

        return ret;
    }

    /// <summary>
    /// Insert event
    /// </summary>
    public void insert()
    {
        // TODO: Add pre-insert logic

        next insert();

        // TODO: Add post-insert logic
    }

    /// <summary>
    /// Update event
    /// </summary>
    public void update()
    {
        // TODO: Add pre-update logic

        next update();

        // TODO: Add post-update logic
    }
}`;
}

const extensionTemplates: Record<string, (baseName: string, prefix: string) => string> = {
  'form-handler': formHandlerTemplate,
  'table-extension': tableExtensionTemplate,
};

const EXTENSION_PATTERNS = new Set(['table-extension', 'form-handler']);

export async function codeGenTool(request: CallToolRequest) {
  try {
    const args = CodeGenArgsSchema.parse(request.params.arguments);

    // Resolve prefix: EXTENSION_PREFIX env var (stripped of trailing '_') or modelName arg → mcp.json → empty
    const resolvedModelName = args.modelName || getConfigManager().getModelName() || '';
    const prefix = resolveObjectPrefix(resolvedModelName);

    let code: string;
    let displayName: string;
    let namingNote: string;

    if (EXTENSION_PATTERNS.has(args.pattern)) {
      // Extension pattern — args.name is the BASE element; prefix becomes the infix
      const extTemplate = extensionTemplates[args.pattern];
      if (!extTemplate) {
        return {
          content: [{ type: 'text', text: `Unknown extension pattern: ${args.pattern}` }],
          isError: true,
        };
      }
      code = extTemplate(args.name, prefix);
      displayName = args.name;
      const exampleClass =
        args.pattern === 'table-extension'
          ? `${args.name}${prefix}_Extension`
          : `${args.name}${prefix}Form_Extension`;
      namingNote = prefix
        ? `📌 **Naming (MS guidelines):** Generated class: \`${exampleClass}\`\n  Base element: \`${args.name}\`, Prefix infix: \`${prefix}\``
        : `⚠️ **No prefix resolved** — set \`EXTENSION_PREFIX\` env var or pass \`modelName\` argument.\n  Generated bare name without prefix infix (e.g. \`${args.name}_Extension\`) which is **not MS-compliant**.`;
    } else {
      // New element pattern — apply prefix to the name
      const newTemplate = newElementTemplates[args.pattern];
      if (!newTemplate) {
        return {
          content: [{ type: 'text', text: `Unknown pattern: ${args.pattern}` }],
          isError: true,
        };
      }
      const finalName = applyObjectPrefix(args.name, prefix);
      code = newTemplate(finalName);
      displayName = finalName;
      namingNote = prefix
        ? `📌 **Naming (MS guidelines):** Object name with prefix: \`${finalName}\``
        : `⚠️ **No prefix resolved** — set \`EXTENSION_PREFIX\` env var or pass \`modelName\` to auto-prefix new objects.`;
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `Generated ${args.pattern} template for "${displayName}":\n\n` +
            `\`\`\`xpp${code}\n\`\`\`\n\n` +
            `---\n\n` +
            `${namingNote}\n\n` +
            `💡 **Next Steps for Better Code Quality:**\n\n` +
            `1. ✅ Use \`analyze_code_patterns("<scenario>")\` - Learn what D365FO classes are commonly used together\n` +
            `2. ✅ Use \`suggest_method_implementation("${displayName}", "<methodName>")\` - Get real implementation examples\n` +
            `3. ✅ Use \`analyze_class_completeness("${displayName}")\` - Check for missing common methods\n` +
            `4. ✅ Use \`get_api_usage_patterns("<ClassName>")\` - See how to use D365FO APIs correctly\n\n` +
            `These tools provide patterns from the actual codebase, not generic templates.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error generating code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}
