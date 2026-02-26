# D365 Finance & Operations X++ Development

This workspace contains Dynamics 365 Finance & Operations (D365FO) code. When working with X++ code, classes, tables, forms, enums, or any D365FO metadata, **always use the specialized MCP tools** described below. These tools provide access to a pre-indexed symbol database with 584,799+ D365FO objects.

## START HERE — Everyday Development Tasks

For **any** request involving existing X++ code, **start with MCP tools — never with built-in tools** (`code_search`, `grep_search`, `semantic_search`, `get_file`).

| Developer Request | Start with these MCP tools |
|-------------------|---------------------------|
| "Fix bug / why doesn't this work?" | `get_class_info` → `suggest_method_implementation` → `find_references` |
| "Refactor / improve this class" | `get_class_info` → `analyze_class_completeness` → `analyze_code_patterns` |
| "Find better solution / best practice" | `analyze_code_patterns` → `get_api_usage_patterns` |
| "Review this code" | `get_class_info` → `analyze_class_completeness` → `find_references` |
| "Optimize this query / method" | `get_table_info` (for indexes) → `analyze_code_patterns` |
| "Where is X used / what calls this?" | `find_references(targetName)` |
| "How does X work / show me the structure" | `get_class_info` / `get_table_info` / `get_form_info` |

**When the user pastes X++ code into the chat:** Always call `get_class_info(className)` first to get the full class context — never work solely from the pasted snippet.

```
User: "Fix the bug in SalesTableType.calcTotalAmount()"
❌ code_search("calcTotalAmount")       → hangs 5+ min, returns raw unparseable XML
✅ get_class_info("SalesTableType")     → returns all methods with source → diagnose
```

## Critical Rules for Tool Usage

### Built-in Tools vs. MCP Tools

The following built-in tools **MUST NOT** be used on D365FO metadata files (.xml, .xpp):

| Built-in Tool ❌ | Use MCP Tool Instead ✅ | Why |
|-----------------|------------------------|-----|
| `code_search` | `search()` or `batch_search()` | Built-in tool cannot parse 500K+ XML files; MCP has pre-indexed symbols |
| `file_search` | `search()` with type filter | D365FO objects are not in workspace; symbols are in external database |
| `get_symbols_by_name` | `search()` or specific tools like `get_class_info()` | MCP tools understand D365FO object hierarchy and inheritance |
| `get_file` | `get_class_info()`, `get_table_info()`, `get_form_info()`, etc. | Source code is embedded in metadata; MCP tools extract it correctly |
| `edit_file` | `modify_d365fo_file()` | Editing XML manually breaks structure; MCP tool validates and backs up |
| `create_file` | `create_d365fo_file()` with optional `generate_d365fo_xml()` first | D365FO files require specific XML schema and AOT structure |
| `apply_patch` | `modify_d365fo_file()` | Patches on XML corrupt metadata; use structured operations instead |

### Code Analysis, Review, and Audit — ALWAYS Use MCP Tools

When analyzing D365FO code, performing code reviews, audits, or investigating issues, **you MUST use MCP tools instead of built-in tools**. Built-in tools like `code_search`, `grep_search`, and `semantic_search` work on plain text and cannot understand D365FO's XML metadata structure.

**For analyzing D365FO code, use these MCP tools:**

| Task | MCP Tool | Why Built-in Tools Fail |
|------|----------|------------------------|
| Find where a class/method is used | `find_references(targetName, targetType?)` | `code_search` searches text, not X++ call graphs |
| Analyze implementation patterns | `analyze_code_patterns(scenario)` | `semantic_search` doesn't understand D365FO frameworks |
| Check API usage examples | `get_api_usage_patterns(apiName)` | `code_search` can't find initialization sequences |
| Verify class completeness | `analyze_class_completeness(className)` | Built-in tools can't detect missing standard methods |
| Review method implementations | `suggest_method_implementation(className, methodName)` | `code_search` returns raw XML, not parsed X++ |
| Inspect full class structure | `get_class_info(className)` | `get_file` returns unparsed XML, not methods with signatures |
| Inspect table schema | `get_table_info(tableName)` | `get_file` doesn't extract fields, indexes, and relations |
| Analyze form datasources | `get_form_info(formName)` | `grep_search` can't parse nested XML hierarchy |
| Find similar tables/forms | `get_table_patterns()`, `get_form_patterns()` | Built-in tools can't compare D365FO patterns |

**Example: Code Review Workflow**
```
User: "Review the SalesTableType class and check if it follows best practices"

❌ WRONG approach:
1. code_search("SalesTableType")  → Returns malformed XML or nothing
2. get_file("SalesTableType.xml")  → Returns unparsable XML metadata

✅ CORRECT approach:
1. get_class_info("SalesTableType")  → Returns all methods with source code
2. analyze_class_completeness("SalesTableType")  → Checks for missing standard methods
3. find_references("SalesTableType")  → Shows where the class is used
4. get_api_usage_patterns("SalesTableType")  → Shows typical usage patterns
```

### Non-Negotiable Rules

1. **NEVER call `get_file`, `read_file`, or `code_search`** on D365FO files (.xml, .xpp)
   - These files are not in the workspace or are unparseable
   - Always fails with path errors or returns malformed XML

2. **NEVER call `get_file` or `read_file` AFTER an MCP tool**
   - MCP result is complete and final
   - If the result seems incomplete, call the MCP tool again with different parameters

3. **NEVER use `edit_file`, `replace_string_in_file`, or `multi_replace_string_in_file`** on D365FO files
   - **ONLY `modify_d365fo_file()` is allowed** for editing .xml metadata
   - These tools break XML indentation, lack X++ syntax validation, and can corrupt metadata

4. **NEVER guess method signatures**
   - Always call `get_method_signature(className, methodName)` before creating Chain of Command (CoC) extensions
   - Incorrect signatures cause compilation errors

5. **NEVER call `create_file` for D365FO objects**
   - **ONLY use `create_d365fo_file()`** for creating D365FO files (classes, tables, forms, enums, etc.)
   - Optional: call `generate_d365fo_xml()` first to get XML content, then pass it to `create_d365fo_file()`
   - `create_file` will corrupt D365FO metadata and break project integration

6. **`generate_smart_table` / `generate_smart_form` — TWO possible success responses, different required actions**

   **Case A — Azure/Linux response** (contains `ℹ️ MCP server is running on Azure/Linux`):
   - The tool generated XML but could not write it to disk (no K:\ drive)
   - The **ONLY correct next action** is `create_d365fo_file(objectType=..., objectName=..., xmlContent="<full XML>", addToProject=true)`
   - ⛔ NEVER try `modify_d365fo_file`, `create_file`, or PowerShell scripts
   - The flow: `generate_smart_table` → XML text → `create_d365fo_file(xmlContent=...)` → **STOP**

   **Case B — Windows direct-write response** (contains `⛔ DO NOT call create_d365fo_file`):
   - The tool wrote the file **directly to disk** — the task is already complete
   - ⛔ **DO NOT call `create_d365fo_file`** — it would overwrite the file unnecessarily
   - ⛔ **DO NOT call `generate_smart_table` again** — the file exists
   - Inform the user of the file path and tell them to reload the VS project — **STOP**

   **How to tell them apart:**
   - Azure/Linux → response contains the XML block and "MANDATORY NEXT STEP"
   - Windows direct → response contains "DO NOT call `create_d365fo_file`" and a file path

7. **Use specific tools for specific object types**
   - For forms: use `get_form_info()`, not `search(type="form")`
   - For queries: use `get_query_info()`, not `search(type="query")`
   - For views/data entities: use `get_view_info()`, not `search(type="view")`

8. **Use correct parameter names**
   - `find_references(targetName=...)` — NOT `symbolName`
   - `get_api_usage_patterns(apiName=...)` — NOT `className`

9. **Use valid code generation patterns**
   - Valid: `class`, `runnable`, `form-handler`, `data-entity`, `batch-job`, `table-extension`
   - Invalid: `coc-extension`, `event-handler`, `service-class` (these do not exist)

10. **ALWAYS search for labels before creating new ones**
   - Call `search_labels(text)` first — reusing existing labels avoids duplication and translation costs
   - When a suitable label exists, use its reference `@LabelFileId:LabelId` directly
   - Only call `create_label()` when no suitable label is found
   - **NEVER edit .label.txt files directly** — use `create_label()` which inserts alphabetically and updates the index

11. **ALWAYS pass `fieldsHint` when user describes table fields**
   - Extract ALL field names from the user's natural language description before calling `generate_smart_table`
   - WITHOUT `fieldsHint` the tool generates ONLY generic defaults → table will be INCOMPLETE
   - Czech/natural language mapping:
     - "Account number" / "účet" → `AccountNum`
     - "Name" / "název" → `Name`
     - "Description" / "popis" → `Description`
     - "platnost od" / "from date" / "ValidFrom" → `ValidFrom`
     - "platnost do" / "to date" / "ValidTo" → `ValidTo`
     - "active" / "flag" → `Active`
   - Example: user says *"primárním klíčem Account number a Name, přidej popis a platnost od-do, metody find a exist"*
     ```
     generate_smart_table(
       name="MyTable",
       fieldsHint="AccountNum, Name, Description, ValidFrom, ValidTo",
       primaryKeyFields=["AccountNum", "Name"],
       methods=["find", "exist"]
     )
     ```
   - **NEVER call `modify_d365fo_file` to add missing fields** — it CANNOT write files on Azure/Linux
   - If the response says **⚠️ INCOMPLETE TABLE**, call `generate_smart_table` AGAIN with proper `fieldsHint` — do NOT proceed to `create_d365fo_file` with incomplete XML

12. **ALWAYS pass `primaryKeyFields` when user specifies a composite primary key**
   - A composite PK = the user says "primary key is X and Y" (two or more fields)
   - Without `primaryKeyFields` the tool auto-detects PK from the FIRST mandatory field only → composite PK will be WRONG
   - Single-field PK: omit `primaryKeyFields` — the tool auto-detects it
   - Composite PK: `primaryKeyFields=["AccountNum", "Name"]` → index contains BOTH fields
   - Example:
     - User: "primary key Account number" → `primaryKeyFields` can be omitted (auto-detected)
     - User: "primary key Account number and Name" → `primaryKeyFields=["AccountNum", "Name"]`

13. **Class/table name MUST match between file name and declaration**
   - When `create_d365fo_file(objectName="MyClass", ...)` is called with prefix applied → file becomes `MyPrefixMyClass.xml`
   - The class declaration inside MUST also be `class MyPrefixMyClass` — **NOT** `class MyClass`
   - `create_d365fo_file` automatically fixes this inconsistency (replaces unprefixed names with prefixed ones)
   - **Rule:** If file is `MyPrefixMyClass.xml`, the X++ declaration must be `public class MyPrefixMyClass extends ...`
   - **Never create:** file `MyPrefixMyClass.xml` containing `class MyClass` — this breaks AOT synchronization

## Available MCP Tools

### 🔍 Search and Discovery (8 tools)

| Tool | Replaces Built-in | Description | Example Usage |
|------|-------------------|-------------|---------------|
| `search(query, type?)` | `code_search`, `file_search`, `get_symbols_by_name` | Searches 584,799+ pre-indexed D365FO symbols by name or keyword. Supports type filters: class, table, method, field, enum, edt, form, query | "Find classes that handle dimension posting" |
| `batch_search(queries[])` | Multiple `code_search` calls | Executes multiple searches in parallel (3× faster than sequential). Use when you need information about several unrelated objects | "Find SalesTable, CustTable, and InventTable" |
| `search_extensions(query)` | `code_search` with ISV filter | Searches only custom/ISV code, filtering out 500K+ Microsoft standard objects | "Find my custom extensions for CustTable" |
| `get_class_info(className)` | `get_file` + `get_symbols_by_name` | Returns complete class definition: all methods with signatures and source code, inheritance chain (extends/implements), and attributes | "Show me everything about SalesFormLetter" |
| `get_table_info(tableName)` | `get_file` + `get_symbols_by_name` | Returns full table schema: all fields with EDT/data types (with explicit EDT marker when present), indexes (including primary key), foreign key relations, and methods | "Show me fields and relations on CustTable" |
| `get_enum_info(enumName)` | `get_symbols_by_name` | Returns all enum values with their integer values and labels. **Note:** For Extended Data Types (EDT), use `get_edt_info()` instead | "What values does SalesStatus have?" |
| `get_edt_info(edtName, modelName?)` | `get_symbols_by_name` | Returns complete EDT definition: base type (Extends), enum type, reference table, string/number constraints, labels, help text, and all EDT properties. **Use this for all EDT queries, not get_enum_info** | "Show me EDT properties for CustAccount" |
| `code_completion(symbolName)` | None (new capability) | Lists available methods and fields on a class or table, with IntelliSense-like filtering | "What methods start with 'calc' on SalesTable?" |

### 🏷️ Label Management (3 tools)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `search_labels(query, language?, model?, labelFileId?)` | Full-text search across all indexed AxLabelFile labels. Searches by ID, text and comment. Returns `@LabelFileId:LabelId` reference syntax. **Call this FIRST before create_label!** | `search_labels("customer name", model="MyModel")` |
| `get_label_info(labelId?, labelFileId?, model?)` | Get all language translations for a label ID, or list available AxLabelFile IDs in a model. Shows ready-to-use X++ and XML snippets. | `get_label_info("MyFeature", model="MyModel")` |
| `create_label(labelId, labelFileId, model, translations[])` | Add a new label to all language .label.txt files in a custom model. Inserts alphabetically. Optionally creates AxLabelFile structure from scratch. Updates the MCP index. | `create_label("MyField", "MyModel", "MyModel", [{language:"en-US", text:"My field"}, {language:"cs", text:"Moje pole"}])` |

### 📊 Advanced Object Information (5 tools)

| Tool | Replaces Built-in | Description | Example Usage |
|------|-------------------|-------------|---------------|
| `get_form_info(formName)` | `get_file` | Parses form XML and returns datasource structure (fields, methods), control hierarchy (buttons, grids, groups), and form-level methods | "Show me datasources in SalesTable form" |
| `get_query_info(queryName)` | `get_file` | Returns query structure: all datasources, joins, field lists, and range definitions | "Analyze CustTransOpenQuery" |
| `get_view_info(viewName)` | `get_file` | Returns view/data entity structure: fields (mapped and computed), relations, primary key, computed columns, and methods. Works for both AxView and AxDataEntityView objects. **Use for data entities** | "Show me GeneralJournalAccountEntryView or CustomerV3Entity" |
| `get_method_signature(className, methodName)` | `get_symbols_by_name` | Extracts exact method signature including modifiers, return type, and parameters with default values. **Essential before Chain of Command extensions** | "Get signature of CustTable.validateWrite()" |
| `find_references(targetName, targetType?)` | None (new capability) | Performs where-used analysis across entire codebase. Works for classes, methods, tables, fields, and enums | "Where is DimensionAttributeValueSet used?" |

### 🧠 Intelligent Code Generation (4 tools)

| Tool | Replaces Built-in | Description | Example Usage |
|------|-------------------|-------------|---------------|
| `analyze_code_patterns(scenario)` | None (new capability) | Analyzes your actual codebase to find most common classes, methods, and dependencies used in a scenario. **Call this before generating code** | "Analyze patterns for ledger journal creation" |
| `suggest_method_implementation(className, methodName)` | None (new capability) | Finds real examples of how similar methods are implemented in your codebase | "How do others implement validateWrite()?" |
| `analyze_class_completeness(className)` | None (new capability) | Checks which standard methods (validateWrite, insert, update, delete, etc.) your class is missing | "Is MyHelper class complete?" |
| `get_api_usage_patterns(apiName)` | None (new capability) | Shows how a specific API/class is typically initialized and used in your codebase, including common method call sequences | "How do I correctly use LedgerJournalEngine?" |
| `generate_code(pattern, name, ...)` | None | Generates X++ boilerplate for common patterns: `class`, `runnable`, `form-handler`, `data-entity`, `batch-job`, `table-extension` | "Generate a batch job for order processing" |

### 🎨 Smart Object Generation (5 tools)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `get_table_patterns(tableGroup?, similarTo?)` | Analyze common patterns in tables: field types, indexes, relations. Query by table group (e.g., "Transaction") or find tables similar to an existing one | `get_table_patterns(tableGroup="Transaction")` or `get_table_patterns(similarTo="CustTable")` |
| `get_form_patterns(formPattern?, tableName?)` | Analyze common patterns in forms: datasource configurations, control hierarchies, form patterns. Find forms using specific table or matching pattern | `get_form_patterns(tableName="SalesTable")` or `get_form_patterns(formPattern="SimpleList")` |
| `suggest_edt(fieldName, context?)` | Suggest Extended Data Types (EDT) for a field name using fuzzy matching and pattern analysis. Returns confidence-ranked suggestions with EDT properties | `suggest_edt(fieldName="CustomerAccount", context="sales order")` |
| `generate_smart_table(name, tableGroup?, copyFrom?, fieldsHint?, primaryKeyFields?, generateCommonFields?, methods?)` | **AI-driven table generation.** Creates AxTable XML with intelligent field/index/relation suggestions. `primaryKeyFields` sets composite PK. `methods` param embeds `find`/`exist` directly in XML — **always use this instead of calling `modify_d365fo_file` afterwards.** | `generate_smart_table(name="MyOrderTable", tableGroup="Transaction", primaryKeyFields=["OrderId"], methods=["find","exist"])` |
| `generate_smart_form(name, dataSource?, formPattern?, copyFrom?, generateControls?)` | **AI-driven form generation.** Creates AxForm XML with intelligent datasource/control suggestions. Can copy structure, analyze patterns, or auto-generate grids | `generate_smart_form(name="MyOrderForm", dataSource="MyOrderTable", generateControls=true)` |

### 📝 File & Metadata Operations (3 tools)

| Tool | Replaces Built-in | Description | When to Use |
|------|-------------------|-------------|-------------|
| `generate_d365fo_xml(objectType, objectName, ...)` | None | Returns D365FO XML content as text. Use with `create_d365fo_file()` for file creation, or alone for inspection/review | Get XML content before creating file, or inspect XML structure |
| `create_d365fo_file(objectType, objectName, modelName, projectPath?, solutionPath?, addToProject?)` | `create_file` | **ONLY tool for creating D365FO files.** Creates physical file in correct AOT location and optionally adds to Visual Studio project. ⚠️ ALWAYS provide `projectPath` (path to `.rnrproj`) or `solutionPath` — tool auto-extracts correct ModelName from the project file. Without them the `modelName` parameter is used AS-IS, which may create files in a Microsoft standard model! | Creating ANY D365FO object (class, table, form, enum, etc.) |
| `modify_d365fo_file(objectType, objectName, operation, ...)` | `edit_file`, `apply_patch`, `replace_string_in_file` | Safely edits D365FO XML with automatic backup (.bak), validation, and rollback on error. Supports: add-method, remove-method, add-field, remove-field, modify-property | Local Windows VM with K:\ drive access |

## Common Workflows

### Creating a New D365FO Object

**Best Practice Workflow:**
1. Call `analyze_code_patterns("description of what you're building")` — learn from existing patterns
2. Call `generate_code(pattern, name)` or get related examples
3. **ALWAYS call `create_d365fo_file(objectType, objectName, modelName, addToProject=true)`** — creates file and adds to project
   - The tool auto-detects the correct model from `.rnrproj` in the workspace
   - **Requires local Windows VM file system access (K:\ drive)** — not available when MCP server is deployed to Azure
   - In a **hybrid setup** (Azure read-only + local write-only), this tool is served by the local MCP companion — GitHub Copilot selects it automatically
   - Optional: call `generate_d365fo_xml()` first, then pass XML to `create_d365fo_file()`
   - **NEVER use `create_file()` for D365FO objects - always use `create_d365fo_file()`**

> ⚠️ **CRITICAL — `projectPath` or `solutionPath` MUST be provided** when calling `create_d365fo_file`:
> - GitHub Copilot **automatically passes the active workspace path** to the MCP server — the server extracts `projectPath` from it by scanning for `.rnrproj` files. **You typically don't need to specify `projectPath` explicitly.**
> - The server also scans well-known dev directories (`K:\VSProjects`, `C:\VSProjects`, etc.) as a fallback.
> - If auto-detection still fails: add `projectPath` to `.mcp.json` (see **📁 File Paths and Model Name** section below).
> - **WITHOUT any resolved `projectPath`**: the tool uses `modelName` AS-IS → file may be created in a **Microsoft standard model** (e.g. `ApplicationSuite`) instead of your custom model!

**Example:**
```
Step 1: analyze_code_patterns("sales order helper class")
Step 2: generate_code(pattern="class", name="MySalesHelper")
Step 3: create_d365fo_file(objectType="class", objectName="MySalesHelper",
          modelName="any",       ← doesn't matter, auto-corrected from .rnrproj
          projectPath="K:\VSProjects\MySolution\MyProject\MyProject.rnrproj",
          addToProject=true)
```

**❌ Wrong — missing `projectPath`:**
```
create_d365fo_file(objectType="class", objectName="MySalesHelper",
  modelName="ApplicationSuite")   ← ❌ No projectPath → file lands in Microsoft's model!
```

**✅ Correct — `projectPath` provided:**
```
create_d365fo_file(objectType="class", objectName="MySalesHelper",
  modelName="whatever",           ← ignored, auto-corrected
  projectPath="K:\VSProjects\MySolution\MyProject\MyProject.rnrproj",
  addToProject=true)
→ Tool reads MyProject.rnrproj → extracts ModelName (e.g. "MyModel")
→ File created at K:\AosService\PackagesLocalDirectory\MyPackage\MyModel\AxClass\MySalesHelper.xml ✅
→ Added to MyProject.rnrproj ✅
```

### Editing an Existing D365FO Object

⚠️ **CRITICAL: Use ONLY `modify_d365fo_file()` for editing D365FO XML files**

**Supported Operations:**
- `add-method` — Add new method to class/table
- `remove-method` — Delete method
- `add-field` — Add field to table
- `remove-field` — Delete field from table  
- `modify-property` — Change XML property value

**Example:**
```xpp
// Add a method to a class
modify_d365fo_file(
  objectType='class',
  objectName='MyClass',
  operation='add-method',
  methodName='calculateDiscount',
  methodCode='public real calculateDiscount(real amount) { return amount * 0.1; }'
)
```

### Creating a Chain of Command Extension

**Workflow:**
1. Call `get_class_info(className)` — understand the class structure
2. Call `get_method_signature(className, methodName)` — **REQUIRED: get exact signature**
3. Call `suggest_method_implementation(className, methodName)` — see real examples
4. Call `generate_code(pattern="class", name="YourExtensionClassName")` with extension pattern
5. **Call `create_d365fo_file()` only** — optionally use `generate_d365fo_xml()` + `create_d365fo_file()`

**Why get_method_signature is required:**
- Incorrect signatures cause compilation errors
- Parameter types, default values, and modifiers must match exactly
- Return type must be identical

**Example:**
```
Step 1: get_class_info("CustTable")
Step 2: get_method_signature("CustTable", "validateWrite")
     → Returns: "public boolean validateWrite(boolean _insertMode)"
Step 3: suggest_method_implementation("CustTable", "validateWrite")
Step 4: Create extension with exact signature from step 2
```

### Implementing or Completing a Method

**Recommended Workflow:**
1. `get_class_info(className)` — get full class with all methods
2. `get_method_signature(className, methodName)` — exact signature
3. Identify dependencies — call `get_class_info()` / `get_table_info()` for any referenced types
4. `analyze_code_patterns("method purpose")` — find real patterns from codebase
5. `suggest_method_implementation(className, methodName)` — see concrete examples
6. Generate implementation based on patterns and examples
7. `modify_d365fo_file()` or `create_d365fo_file()` to save changes

### Finding Information About Objects

**Quick Reference:**

| What You Need | Tool to Use |
|---------------|-------------|
| "Does a class named X exist?" | `search("X", type="class")` |
| "Show me all methods on class X" | `get_class_info("X")` |
| "What fields does table X have?" | `get_table_info("X")` |
| "What are the enum values for X?" | `get_enum_info("X")` |
| "What are the EDT properties for X?" | `get_edt_info("X")` |
| "Where is class/method X used?" | `find_references("X")` |
| "Find multiple objects at once" | `batch_search([{query: "CustTable"}, {query: "SalesTable"}])` |
| "Find only my custom code" | `search_extensions("MyPrefix")` |
| "What datasources does form X have?" | `get_form_info("X")` |
| "What is the structure of data entity X?" | `get_view_info("X")` |
| "How is API X typically used?" | `get_api_usage_patterns("X")` |
| "Find label for text X" | `search_labels("X")` |
| "Get all translations for label X" | `get_label_info("X")` |
| "What label files exist in model X?" | `get_label_info(model="X")` |
| "Suggest EDT for field name X" | `suggest_edt("X")` |
| "Find similar tables to X" | `get_table_patterns(similarTo="X")` |
| "Find forms using table X" | `get_form_patterns(tableName="X")` |
| "Generate table with AI" | `generate_smart_table(name="X", generateCommonFields=true)` |
| "Generate form for table X" | `generate_smart_form(name="XForm", dataSource="X", generateControls=true)` |

### Generating Smart Tables and Forms

**Workflow for creating a new table with AI assistance:**
```
Step 1: get_table_patterns(tableGroup="Transaction")
     → Analyze common field patterns in transaction tables
Step 2: suggest_edt("OrderAmount", context="sales order")
     → Get EDT suggestions for specific fields
Step 3: generate_smart_table(
          name="MyOrderTable",
          tableGroup="Transaction",
          fieldsHint="OrderId, CustomerAccount, OrderAmount, OrderDate",
          generateCommonFields=true,
          projectPath="K:\VSProjects\MySolution\MyProject\MyProject.rnrproj"
        )
     → Generates complete table with fields, indexes, and relations
```

**Workflow for creating a new form with AI assistance:**
```
Step 1: get_form_patterns(formPattern="SimpleList")
     → Analyze common patterns in SimpleList forms
Step 2: generate_smart_form(
          name="MyOrderForm",
          dataSource="MyOrderTable",
          formPattern="SimpleList",
          generateControls=true,
          projectPath="K:\VSProjects\MySolution\MyProject\MyProject.rnrproj"
        )
     → Generates complete form with datasource and grid controls
```

**Workflow for copying existing table structure:**
```
Step 1: get_table_info("CustTable")
     → Review structure of source table
Step 2: generate_smart_table(
          name="MyCustomerTable",
          copyFrom="CustTable",
          projectPath="K:\VSProjects\MySolution\MyProject\MyProject.rnrproj"
        )
     → Creates table with copied structure (fields, indexes, relations)
```

**Workflow for copying existing form structure:**
```
Step 1: get_form_info("CustTableListPage")
     → Review structure of source form
Step 2: generate_smart_form(
          name="MyCustomerListPage",
          copyFrom="CustTableListPage",
          projectPath="K:\VSProjects\MySolution\MyProject\MyProject.rnrproj"
        )
     → Creates form with copied datasources and pattern
```

**Workflow for hybrid setup (Azure read-only + local Windows VM write-only):**
```
Step 1: generate_smart_table(
          name="MyOrderTable",
          tableGroup="Transaction",
          fieldsHint="OrderId, CustomerAccount, OrderAmount, OrderDate",
          primaryKeyFields=["OrderId"],
          generateCommonFields=true,
          methods=["find","exist"]    ← embed methods in XML — do NOT call modify_d365fo_file afterwards
        )
     → Returns "ℹ️ MCP server is running on Azure/Linux" + XML block + MANDATORY NEXT STEP

Step 2: create_d365fo_file(           ← IMMEDIATELY after step 1, no intermediate steps
          objectType="table",
          objectName="MyOrderTable",   ← use the prefixed name from step 1 response
          xmlContent="<full XML from step 1>",
          addToProject=true
        )
     → Writes file to K:\AosService\PackagesLocalDirectory\MyPackage\MyModel\AxTable\...
     → Adds entry to .rnrproj for VS2022
     → Returns "TASK COMPLETE" — STOP here, do NOT call generate_smart_table again

⛔ FORBIDDEN alternatives when generate_smart_table returns XML text:
   - create_file()                  ← NEVER — corrupts D365FO metadata
   - PowerShell / shell scripts     ← NEVER — bypasses AOT structure
   - modify_d365fo_file()           ← NEVER — not a substitute for create_d365fo_file
   - Calling generate_smart_table again after create_d365fo_file succeeds ← LOOP!
```

**Workflow for Windows-only (full mode, single server):**
```
Step 1: generate_smart_table(
          name="MyOrderTable",
          fieldsHint="OrderId, CustomerAccount, OrderAmount, OrderDate",
          primaryKeyFields=["OrderId"],
          methods=["find","exist"]
        )
     → Returns "✅ Table created directly on the Windows VM" + file path
     → File is ALREADY written to K:\...\AxTable\MyOrderTable.xml

⛔ STOP — do NOT call create_d365fo_file (file already exists)
⛔ STOP — do NOT call generate_smart_table again
→ Tell the user: file path + "reload the VS project and build"
```

Same patterns apply for generate_smart_form.
```



**Workflow for using an existing label:**
```
Step 1: search_labels("your text", language="en-US")
     → Returns matching labels with @LabelFileId:LabelId syntax
Step 2: get_label_info("MyFeature", model="MyModel")
     → Verify all required languages are present
Step 3: Use @MyModel:MyFeature in X++ code or metadata XML
```

**Workflow for creating a new label:**
```
Step 1: search_labels("your text") — REQUIRED: check existing labels first!
Step 2: get_label_info(model="MyModel") — list available label files in model
Step 3: create_label(
          labelId="MyNewField",
          labelFileId="MyModel",
          model="MyModel",
          translations=[
            {language:"en-US", text:"My new field"},
            {language:"cs",    text:"Moje nové pole"},
            {language:"de",    text:"Mein neues Feld"},
            {language:"sk",    text:"Moje nové pole"}
          ],
          defaultComment="Description for developers"
        )
Step 4: Use @MyModel:MyNewField in code or XML
```

**Label reference syntax:**
- In X++ code: `literalStr("@MyModel:MyLabel")` or `"@MyModel:MyLabel"` in string fields
- In metadata XML: `<Label>@MyModel:MyLabel</Label>`
- In field properties: `<HelpText>@MyModel:MyLabelHelp</HelpText>`

## Best Practices

### 📁 File Paths and Model Name

AOT path structure on the local Windows VM:
```
K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxClass\{Name}.xml
K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxTable\{Name}.xml
K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxForm\{Name}.xml
K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxEnum\{Name}.xml
K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxQuery\{Name}.xml
K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxView\{Name}.xml
```

**ModelName is automatically extracted from the `.rnrproj` file** (`PropertyGroup/ModelName`)

| Situation | Result |
|-----------|--------|
| `projectPath` or `solutionPath` provided | ✅ Tool reads correct `ModelName` from `.rnrproj` |
| Neither provided, `modelName="ApplicationSuite"` | ❌ File created in Microsoft's standard model — WRONG! |
| Neither provided, `modelName="MyModel"` | ✅ Only if value happens to match actual model name |

**Rules:**
- ✅ **ALWAYS provide `projectPath` or `solutionPath`** when calling `create_d365fo_file`
- ❌ **NEVER ask the user for `modelName`** — pass any value, it will be auto-corrected from `.rnrproj`
- ❌ **NEVER manually extract `modelName` from workspace path** — workspace path ≠ AOT path
- ❌ **NEVER call `create_d365fo_file(modelName="ApplicationSuite", ...)`** without `projectPath`/`solutionPath`!
- `ApplicationSuite` is a **Microsoft standard model** — never add custom code there!

**`.mcp.json` configuration** (fallback when GitHub Copilot auto-detection is unavailable):
```json
{
  "servers": {
    "context": {
      "projectPath": "K:\\VSProjects\\MySolution\\MyProject\\MyProject.rnrproj",
      "solutionPath": "K:\\VSProjects\\MySolution",
      "packagePath": "K:\\AosService\\PackagesLocalDirectory"
    }
  }
}
```
⚠️ This file must be placed **in the MCP server directory** (next to `package.json`), NOT in the VS solution folder — the MCP server process reads it from its own working directory.

**XML formatting rules:**
- ✅ TABs for indentation (Microsoft D365FO standard — not spaces!)
- ❌ NEVER spaces — causes XML deserialization errors in Visual Studio
- ✅ CDATA for X++ source code: `<![CDATA[ ... ]]>`

### ✅ DO:
- Use MCP tools for ALL D365FO metadata operations
- **Use MCP tools for code analysis, review, and audit** — `find_references()`, `analyze_code_patterns()`, `get_api_usage_patterns()`, `analyze_class_completeness()`
- Call `get_method_signature()` before creating CoC extensions
- Call `analyze_code_patterns()` before generating new code
- Use `batch_search()` when you need multiple objects
- Use `search_extensions()` to filter out Microsoft standard code
- Use `modify_d365fo_file()` with automatic backups for safe editing
- Be specific in search queries (include context like "sales", "ledger", "inventory")
- **Use `get_edt_info()` for Extended Data Types** — `get_enum_info()` is for enums only
- **Call `search_labels()` before `create_label()`** — always reuse existing labels when possible
- Provide translations for ALL languages the model supports when calling `create_label()`
- **Call `suggest_edt()` when creating new table fields** — reuse existing EDTs instead of creating primitives
- **Use `get_table_patterns()` or `get_form_patterns()` before generating objects** — learn from existing patterns
- **Use `generate_smart_table()` / `generate_smart_form()` for new objects** — AI-driven generation with pattern analysis
- **Always pass `methods=["find","exist"]` to `generate_smart_table()`** when the user requests these methods — embed them in the XML directly, never call `modify_d365fo_file` afterwards

### ❌ DON'T:
- Never use built-in file tools (`get_file`, `edit_file`, etc.) on .xml or .xpp files
- **Never use built-in analysis tools (`code_search`, `grep_search`, `semantic_search`) for D365FO code** — they cannot parse XML metadata; use MCP tools instead
- Never guess method signatures — always look them up
- Never use `replace_string_in_file` on D365FO XML — it corrupts metadata
- **Never create D365FO files with generic `create_file` — ONLY use `create_d365fo_file()`**
- **Never combine `generate_d365fo_xml()` + `create_file()` — use `generate_d365fo_xml()` + `create_d365fo_file()` instead**
- **Never call `create_d365fo_file()` without `projectPath` or `solutionPath`** — without them `modelName` is used AS-IS and the file may end up in a Microsoft standard model!
- **Never use `get_enum_info()` for EDT** — it only works for enums; use `get_edt_info()` for Extended Data Types
- Don't use vague search terms — be specific about what you're looking for
- Don't call `search()` after you already have the complete object from `get_class_info()`
- **Never edit .label.txt files with `edit_file` or `replace_string_in_file`** — use `create_label()` which maintains sort order and updates the index
- **Never call `create_d365fo_file` with incomplete XML** — if `generate_smart_table` response shows ⚠️ INCOMPLETE TABLE, REGENERATE with `fieldsHint` first
- **Never omit `fieldsHint`** when user describes fields — extract them from natural language and pass explicitly; without them the table is empty
- **Never omit `primaryKeyFields`** when user specifies a composite PK (two or more fields) — without it only the first mandatory field is used and the PK will be wrong
- **Never omit `methods=["find","exist"]`** when user asks for those methods — pass in `generate_smart_table`, not via `modify_d365fo_file`
- Never create a label without first calling `search_labels()` — duplicate labels waste translation effort
- **Never manually specify EDT types like "String", "Int"** — call `suggest_edt()` to find correct Extended Data Type
- **Never create tables/forms without analyzing patterns first** — use `get_table_patterns()`/`get_form_patterns()` to learn from existing code
- **🚨 CRITICAL: NEVER include the model prefix in the `name` parameter of `generate_smart_table` or `generate_smart_form`** — always pass the base name without prefix (e.g., `name="AccountTable"`, NOT `name="MyAccountTable"`). The tool applies the prefix automatically from `modelName` parameter, `D365FO_MODEL_NAME` env var, or `.rnrproj` detection. Pre-applied prefix causes double-prefixing (e.g., `MyMyAccountTable`).
- **Never call `modify_d365fo_file` after `generate_smart_table` to add methods** — use the `methods` parameter instead; `modify_d365fo_file` fails on Azure/Linux (read-only mode)
- **🚨 NEVER use `create_file` or PowerShell as a fallback when `generate_smart_table`/`generate_smart_form` returns XML as text** — the `ℹ️ Azure/Linux` message in the response means "pass this XML to `create_d365fo_file(xmlContent=...)`", not "the tool failed". There is NO other acceptable approach.
- **NEVER interpret `generate_smart_table`/`generate_smart_form` returning XML as a partial failure** — it is a complete success; `create_d365fo_file(xmlContent=...)` is the mandatory and only next step
- **🚨 NEVER call `create_d365fo_file` when `generate_smart_table`/`generate_smart_form` response contains `⛔ DO NOT call create_d365fo_file`** — the file was written directly on Windows; calling `create_d365fo_file` creates a loop
- **🚨 NEVER call `generate_smart_table` or `generate_smart_form` again after a success response** — once either tool reports success (regardless of Windows or Azure path), the task is COMPLETE; calling them again creates duplicates

## Why MCP Tools Are Required

1. **Scale**: 584,799+ objects cannot be searched with standard tools
2. **Format**: D365FO metadata is complex XML not parseable by generic tools
3. **Location**: Objects are not in workspace — they're in external AOT/PackagesLocalDirectory
4. **Performance**: Pre-indexed database provides instant results
5. **Safety**: Built-in validation, backup, and rollback for modifications
6. **Context**: Tools understand X++ language semantics, inheritance, and D365FO patterns
7. **Analysis**: Tools provide call graphs, usage patterns, and completeness checks that built-in tools cannot perform