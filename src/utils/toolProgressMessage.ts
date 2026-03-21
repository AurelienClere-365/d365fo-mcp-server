/**
 * Builds a human-readable progress/status description for a given tool call.
 * Used in two places:
 *   - stdio mode  → sent as MCP notifications/message BEFORE the tool runs (visible in chat)
 *   - HTTP mode   → prepended to the tool result text (visible when expanding the tool call)
 */
export function buildProgressMessage(toolName: string, args: Record<string, any> | undefined): string {
  const a = args ?? {};
  switch (toolName) {
    case 'search':
      return `🔍 Searching D365FO index: "${a.query ?? ''}"${a.type ? ` [${a.type}]` : ''}`;
    case 'batch_search':
      return `🔍 Batch search: ${Array.isArray(a.queries) ? a.queries.map((q: any) => `"${q.query ?? q}"`).join(', ') : ''}`;
    case 'search_extensions':
      return `🔍 Searching custom extensions: "${a.query ?? ''}"`;
    case 'get_class_info':
      return `📦 Reading class ${a.className ?? ''}${a.compact === false ? ' (full bodies)' : ''}`;
    case 'get_table_info':
      return `📋 Reading table ${a.tableName ?? ''}`;
    case 'get_method_source':
      return `📖 Reading source of ${a.className ?? ''}.${a.methodName ?? ''}`;
    case 'get_method_signature':
      return `🔑 Reading signature of ${a.className ?? ''}.${a.methodName ?? ''}`;
    case 'get_form_info':
      return `🖼️ Reading form ${a.formName ?? ''}${a.searchControl ? ` (control: "${a.searchControl}")` : ''}`;
    case 'get_query_info':
      return `🗃️ Reading query ${a.queryName ?? ''}`;
    case 'get_view_info':
      return `👁️ Reading view ${a.viewName ?? ''}`;
    case 'get_enum_info':
      return `📝 Reading enum ${a.enumName ?? ''}`;
    case 'get_edt_info':
      return `📐 Reading EDT ${a.edtName ?? ''}`;
    case 'get_report_info':
      return `📊 Reading report ${a.reportName ?? ''}`;
    case 'get_data_entity_info':
      return `📡 Reading data entity ${a.entityName ?? ''}`;
    case 'find_references':
      return `🔗 Finding references to ${a.targetName ?? ''}`;
    case 'find_coc_extensions':
      return `🔗 Finding CoC extensions of ${a.className ?? ''}${a.methodName ? `.${a.methodName}` : ''}`;
    case 'find_event_handlers':
      return `🔗 Finding event handlers for ${a.targetName ?? a.targetTable ?? ''}`;
    case 'get_security_artifact_info':
      return `🔒 Reading security artifact ${a.name ?? ''}`;
    case 'get_security_coverage_for_object':
      return `🔒 Reading security coverage for ${a.objectName ?? ''}`;
    case 'get_menu_item_info':
      return `📋 Reading menu item ${a.name ?? ''}`;
    case 'get_table_extension_info':
      return `🔧 Reading extensions of table ${a.tableName ?? ''}`;
    case 'analyze_extension_points':
      return `🔍 Analyzing extension points of ${a.objectName ?? ''}`;
    case 'analyze_code_patterns':
      return `📐 Analyzing code patterns: "${a.scenario ?? ''}"`;
    case 'suggest_method_implementation':
      return `💡 Suggesting implementation for ${a.className ?? ''}.${a.methodName ?? ''}`;
    case 'analyze_class_completeness':
      return `✅ Analyzing completeness of class ${a.className ?? ''}`;
    case 'get_api_usage_patterns':
      return `📐 API usage patterns for ${a.apiName ?? ''}`;
    case 'create_d365fo_file':
      return `📁 Creating ${a.objectType ?? 'object'} ${a.objectName ?? ''}`;
    case 'generate_d365fo_xml':
      return `🔧 Generating XML for ${a.objectType ?? 'object'} ${a.objectName ?? ''}`;
    case 'modify_d365fo_file':
      return `✏️ ${a.operation ?? 'Modifying'} on ${a.objectType ?? 'object'} ${a.objectName ?? ''}`;
    case 'generate_smart_table':
      return `🏗️ Generating smart table ${a.name ?? ''}`;
    case 'generate_smart_form':
      return `🏗️ Generating smart form ${a.name ?? ''}`;
    case 'generate_smart_report':
      return `🏗️ Generating smart report ${a.name ?? ''}`;
    case 'get_table_patterns':
      return `📐 Getting table patterns${a.tableGroup ? ` [${a.tableGroup}]` : ''}${a.similarTo ? ` similar to ${a.similarTo}` : ''}`;
    case 'get_form_patterns':
      return `📐 Getting form patterns${a.formPattern ? ` [${a.formPattern}]` : ''}`;
    case 'suggest_edt':
      return `💡 Suggesting EDT for field "${a.fieldName ?? ''}"`;
    case 'search_labels':
      return `🏷️ Searching labels: "${a.query ?? ''}"`;
    case 'get_label_info':
      return `🏷️ Reading label info${a.labelId ? ` for ${a.labelId}` : ''}`;
    case 'create_label':
      return `🏷️ Creating label ${a.labelId ?? ''}`;
    case 'rename_label':
      return `🏷️ Renaming label ${a.oldLabelId ?? ''} → ${a.newLabelId ?? ''}`;
    case 'validate_object_naming':
      return `✅ Validating name "${a.proposedName ?? ''}" for ${a.objectType ?? ''}`;
    case 'verify_d365fo_project':
      return `✅ Verifying D365FO project${a.projectPath ? ` at ${a.projectPath}` : ''}`;
    case 'update_symbol_index':
      return `🔄 Updating symbol index${a.filePath ? ` for ${a.filePath}` : ''}`;
    case 'build_d365fo_project':
      return `🔨 Building D365FO project${a.projectPath ? ` ${a.projectPath}` : ''}`;
    case 'trigger_db_sync':
      return `🗄️ Triggering database sync${a.tableName ? ` for ${a.tableName}` : ''}`;
    case 'run_bp_check':
      return `🔍 Running Best Practices check${a.targetFilter ? ` on ${a.targetFilter}` : ''}`;
    case 'run_sys_test':
    case 'run_systest_class':
      return `🧪 Running unit tests: ${a.className ?? ''}`;
    case 'review_workspace_changes':
      return `🔍 Reviewing workspace changes${a.directoryPath ? ` in ${a.directoryPath}` : ''}`;
    case 'undo_last_modification':
      return `↩️ Undoing last modification${a.filePath ? ` of ${a.filePath}` : ''}`;
    case 'get_workspace_info':
      return `⚙️ Reading workspace configuration`;
    case 'get_xpp_knowledge':
      return `📚 Reading X++ knowledge: "${a.topic ?? ''}"`;
    case 'get_d365fo_error_help':
      return `🆘 Looking up D365FO error: "${String(a.errorText ?? '').slice(0, 80)}"`;
    case 'generate_code':
      return `🔧 Generating code pattern "${a.pattern ?? ''}" for ${a.name ?? ''}`;
    case 'code_completion':
      return `💡 Code completion for "${a.symbolName ?? ''}"`;
    default:
      return `⚙️ Running ${toolName}`;
  }
}
