# D365FO X++ Development

This is a D365FO workspace. Always use MCP tools for any X++ code task. Never use built-in tools (read_file, semantic_search, file_search, grep_search, code_search) on D365FO objects — there are 500 000+ XML files and they are not in the workspace. All symbols are pre-indexed in the MCP server.

## Non-negotiable rules

- NEVER call read_file on .xml or .xpp files — always fails with path errors.
- NEVER call read_file AFTER an MCP tool — MCP result is complete and final. If incomplete, call the MCP tool again.
- NEVER call replace_string_in_file or multi_replace_string_in_file on .xml D365FO files — always use modify_d365fo_file().
- NEVER edit D365FO code with replace_string_in_file — ONLY modify_d365fo_file() is allowed for .xml files.
- NEVER guess method signatures — always call get_method_signature() before any CoC extension.
- NEVER call create_file for D365FO objects — always use create_d365fo_file().
- NEVER use search(type="form|query|view") — use get_form_info / get_query_info / get_view_info.
- NEVER use find_references(symbolName=...) — correct parameter is targetName.
- NEVER use get_api_usage_patterns(className=...) — correct parameter is apiName.
- NEVER use generate_code(pattern="coc-extension|event-handler|service-class") — these patterns do not exist.

## Tool mapping

| Task | Tool |
|------|------|
| Find any object | search(query, type?) |
| Find 2+ objects at once | batch_search(queries[]) |
| Find custom/ISV code only | search_extensions(query) |
| Class details + source | get_class_info(className) |
| Table fields + indexes | get_table_info(tableName) |
| Form datasources + controls | get_form_info(formName) |
| Method signature for CoC | get_method_signature(className, methodName) |
| Enum values | get_enum_info(enumName) |
| Real code patterns before generating | analyze_code_patterns(scenario) |
| Method implementation examples | suggest_method_implementation(className, methodName) |
| How an API is used | get_api_usage_patterns(apiName) |
| Generate boilerplate | generate_code(pattern, name) — patterns: class, runnable, form-handler, data-entity, batch-job, table-extension |
| Create D365FO file | create_d365fo_file(objectType, objectName, modelName, addToProject=true) |
| Modify existing file | modify_d365fo_file(objectType, objectName, operation, ...) |
| Where is X used | find_references(targetName, targetType?) |

## Creating files

Always call create_d365fo_file(). The tool auto-detects the correct model from .rnrproj in the open workspace — pass any value for modelName, it will be overridden. Without projectPath/solutionPath the modelName is used as-is and may land in a Microsoft model.

If create_d365fo_file() returns "requires file system access", fall back to generate_d365fo_xml() and save with create_file().

## Editing D365FO files

⚠️ **CRITICAL: For ANY edit to D365FO XML files (.xml), you MUST use modify_d365fo_file(). NEVER use replace_string_in_file or multi_replace_string_in_file.**

**ALWAYS** use modify_d365fo_file() for editing D365FO XML files (.xml). **NEVER** use replace_string_in_file or multi_replace_string_in_file — they break XML structure.

### Supported operations:

| Operation | Use case | Example |
|-----------|----------|---------|
| add-method | Add new method to class/table | modify_d365fo_file(objectType='class', objectName='MyClass', operation='add-method', methodName='calculate', methodCode='...') |
| remove-method | Delete method | modify_d365fo_file(operation='remove-method', methodName='oldMethod') |
| add-field | Add field to table | modify_d365fo_file(objectType='table', operation='add-field', fieldName='Status', fieldType='EnumType') |
| remove-field | Delete field | modify_d365fo_file(operation='remove-field', fieldName='obsoleteField') |
| modify-property | Change property value | modify_d365fo_file(operation='modify-property', propertyPath='ConfigKey', propertyValue='MyConfig') |

### Why not replace_string_in_file?

- ❌ Breaks XML indentation and formatting
- ❌ No validation of X++ syntax
- ❌ No automatic backup
- ❌ Can corrupt D365FO metadata
- ✅ modify_d365fo_file does all of the above correctly

## Workflow for "implement / complete a method"

1. get_class_info(className) — get full class with all methods
2. get_method_signature(className, methodName) — exact signature
3. get_class_info() / get_table_info() for any other classes/tables mentioned
4. analyze_code_patterns("description") — real codebase patterns
5. suggest_method_implementation(className, methodName)
6. modify_d365fo_file() or create_d365fo_file() to save