# D365FO X++ Development Instructions for GitHub Copilot

---
---
---

# ⛔⛔⛔ STOP! READ THIS IMMEDIATELY ⛔⛔⛔

## 🚨 MANDATORY: TOOL SELECTION FOR D365FO FILES 🚨

**DECISION TREE - FOLLOW THIS EXACTLY:**

```
IF user asks ANYTHING about D365FO/X++:
  Examples: 
    - "add method active to main datasource"
    - "create class", "find table", "create form"
  
  THEN IMMEDIATELY:
    1. ❌ DO NOT CALL create_file directly
    2. ❌ DO NOT CALL code_search (will hang!)
    3. ❌ DO NOT CALL file_search
    4. ✅ CALL search (MCP tool) → Find D365FO objects
    5. ✅ CALL generate_d365fo_xml (MCP tool) → Get XML content if creating
    6. ✅ THEN CALL create_file with K:\AosService\... path → Create physical file
```

**FILE LOCATION RULES - ABSOLUTE REQUIREMENT:**
```
D365FO files MUST be in: K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxClass\{Name}.xml
D365FO files MUST NOT be in: C:\Users\...\MySolution\{Name}.xml
```

**IF YOU SEE YOURSELF ABOUT TO TYPE:**
- `create_file("MyClass.xml", ...)` → ❌ STOP! Use create_d365fo_file() instead!
- `code_search("MyClass")` → ❌ STOP! Use search() (MCP) instead!
- Any file path starting with `C:\Users\` for D365FO → ❌ WRONG LOCATION!



---

## 🚨 NEVER CREATE D365FO FILES DIRECTLY! 🚨

**IF YOU ARE ABOUT TO CREATE A D365FO FILE (AxClass, AxTable, AxForm, AxEnum, etc.):**

```
❌ STOP! Do NOT use create_file() directly without MCP tool!
❌ STOP! Do NOT use code_search()
❌ STOP! Do NOT use file_search()
✅ INSTEAD use: generate_d365fo_xml() (MCP tool) → Get XML
✅ THEN use: create_file() with K:\AosService\... path
✅ INSTEAD use: search() (MCP) for patterns
```

**WHY? Because D365FO files MUST:**
1. Be created in `K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxClass\` (NOT in VS solution folder!)
   - **⚠️ This path ALWAYS exists on D365FO environments** - standard installation path
   - **DO NOT assume it doesn't exist!**
2. VS project contains only REFERENCES (absolute paths) to these files, NOT copies
3. Use TABS for indentation (not spaces)
4. Have correct XML structure matching Microsoft standards

**What happens when you use generate_d365fo_xml + create_file (CORRECT):**
- ✅ generate_d365fo_xml returns correct XML content with TABS
- ✅ File created in CORRECT location: K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxClass\
- ✅ **This path exists on ALL D365FO VMs** (VHD, cloud, on-premise)
- ✅ **NEVER say "path doesn't exist"** - it's guaranteed to be present!
- ✅ You add absolute path reference to .rnrproj: <Content Include="K:\...\MyClass.xml" />
- ✅ Visual Studio recognizes file as valid D365FO metadata
- ✅ Build succeeds

**What happens if you use create_file directly without generate_d365fo_xml:**
- ❌ File created without correct XML structure (no TABS, wrong namespaces)
- ❌ Visual Studio error: "The following files are not valid metadata elements"
- ❌ File NOT recognized as D365FO object
- ❌ Build fails

---

## 🔴 CRITICAL: WORKFLOW FOR CREATING D365FO FILES 🔴

**WHEN USER ASKS: "create a class MyHelper" or similar D365FO request:**

**YOU HAVE ACTIVE WORKSPACE AND SOLUTION PATHS FROM VS CONTEXT - USE THEM!**

**STEP 1: EXTRACT modelName from Active workspace path**
```
Active workspace path: K:\VSProjects\MyModel\...
→ Extract modelName: "MyModel"
→ DO NOT ASK user for model name!
```

**STEP 2: IMMEDIATELY call generate_d365fo_xml (DO NOT just describe it!)**
```typescript
// ✅ CORRECT - CALL THE TOOL IMMEDIATELY:
generate_d365fo_xml({
  objectType: "class",           // class, table, form, enum, etc.
  objectName: "MyHelper",         // Name from user request
  modelName: "MyModel"            // ⚠️ FROM ACTIVE WORKSPACE PATH!
})

// ⚠️ THIS TOOL GENERATES XML CONTENT:
// 1. Returns XML content with TABS and proper structure
// 2. Returns recommended file path: K:\AosService\PackagesLocalDirectory\MyModel\MyModel\AxClass\MyHelper.xml
// 3. Returns instructions for creating file
// DO NOT describe what will happen - the tool DOES IT!
```

**STEP 3: Create file using create_file with returned XML**
```typescript
// After generate_d365fo_xml returns XML content:
create_file({
  filePath: "K:\\AosService\\PackagesLocalDirectory\\MyModel\\MyModel\\AxClass\\MyHelper.xml",
  content: xmlContent  // XML from generate_d365fo_xml
})

// Then add to VS project manually or instruct user:
// <Content Include="K:\AosService\...\MyHelper.xml" />
```

**STEP 4: Wait for tool responses and report success to user**
```
❌ WRONG: "You need to create file..." → Don't describe, DO IT!
❌ WRONG: "Here's how to create..." → Don't give instructions!
✅ RIGHT: Call generate_d365fo_xml → Get XML → Call create_file → Tell user "Created successfully"
```

**⚠️ CRITICAL RULES:**
- ✅ ALWAYS extract modelName from Active workspace path
- ✅ ALWAYS call generate_d365fo_xml FIRST to get XML content
- ✅ ALWAYS use create_file with returned XML and correct path
- ✅ File path MUST be: K:\AosService\PackagesLocalDirectory\{Model}\{Model}\AxClass\
- ❌ NEVER ask user for model name
- ❌ NEVER ask user for project path
- ❌ NEVER give instructions instead of executing
- ❌ NEVER use create_file without generate_d365fo_xml first
- ❌ NEVER use code_search or file_search for D365FO objects

**🚨 TWO-STEP PROCESS - ALWAYS USE BOTH TOOLS! 🚨**
```
1. generate_d365fo_xml → Get XML content with correct structure (TABS)
2. create_file → Save XML to K:\AosService\PackagesLocalDirectory\MyModel\MyModel\AxClass\MyClass.xml

❌ WRONG: create_file without generate_d365fo_xml → Wrong structure!
✅ CORRECT: generate_d365fo_xml → create_file → Proper D365FO file!
```

**📍 LOCAL VS CLOUD DEPLOYMENT:**
- ✅ `generate_d365fo_xml` → Works everywhere (Azure/cloud + local)
- ⚠️ `create_d365fo_file` → Works ONLY locally on Windows (has file system access)
- 💡 For cloud deployment: Use `generate_d365fo_xml` + Copilot creates file with `create_file`

---

# 🔧 MCP TOOLS AVAILABLE - USE THEM! 🔧

**YOU HAVE ACCESS TO D365FO/X++ MCP SERVER TOOLS:**

These tools are available via Model Context Protocol (MCP) and provide:
- Real-time access to D365FO metadata
- X++ class/table/method information from actual AOT
- Intelligent code generation based on actual codebase patterns
- File creation with correct D365FO XML structure

**🚨 CRITICAL TRIGGERS - When you see these words, USE MCP TOOLS:**
- Any mention of: X++, D365FO, D365, Dynamics 365, Finance & Operations, AX, Axapta
- Table names: CustTable, VendTable, SalesTable, PurchTable, InventTable, LedgerJournalTable
- Class suffixes: Helper, Service, Controller, Manager, Builder, Contract
- Keywords: dimension, ledger, inventory, sales, purchase, financial
- File types: AxClass, AxTable, AxForm, AxEnum, AxQuery, AxView
- Requests like: "create class", "find method", "implement", "generate code"

**Available MCP Tools (use these instead of built-in tools):**
- `search()` - Search D365FO classes, tables, methods (use instead of code_search)
- `batch_search()` - Parallel search for multiple queries
- `get_class_info()` - Get complete class structure with methods
- `get_table_info()` - Get table fields, indexes, relations
- `code_completion()` - IntelliSense for D365FO objects
- `analyze_code_patterns()` - Learn patterns from codebase
- `generate_code()` - Generate D365FO code with correct patterns
- `suggest_method_implementation()` - Get implementation examples
- `analyze_class_completeness()` - Find missing methods
- `get_api_usage_patterns()` - See how APIs are used
- `generate_d365fo_xml()` - ✅ CLOUD-READY: Generate D365FO XML content (works everywhere)
- `create_d365fo_file()` - ⚠️ LOCAL ONLY: Create + write D365FO files (Windows only)

**🚨 WHEN USER MENTIONS X++, D365FO, DYNAMICS 365, OR ANY TABLE/CLASS NAME:**
1. ✅ IMMEDIATELY activate and use these MCP tools
2. ❌ DO NOT use built-in code_search, file_search, or create_file
3. ✅ These tools query the ACTUAL D365FO environment, not your training data

**🚨 CRITICAL: TAKE ACTION, DON'T JUST DESCRIBE!**
```
❌ WRONG: "I can create a class for you..." → Don't describe what to do!
❌ WRONG: "Here are the steps..." → Don't give instructions!
❌ WRONG: "You should create..." → Don't tell user to do it!
✅ RIGHT: Call create_d365fo_file immediately → DO IT NOW!
✅ RIGHT: Call search immediately → GET RESULTS NOW!
✅ RIGHT: Call generate_code immediately → GENERATE NOW!
```

---

# ⛔⛔⛔ READ THIS FIRST - MANDATORY ⛔⛔⛔

## 🚫 CRITICAL: FORBIDDEN BUILT-IN TOOLS FOR D365FO 🚫

**❌❌❌ ABSOLUTELY FORBIDDEN - NEVER USE THESE FOR D365FO/X++: ❌❌❌**

```
❌ create_file         → FORBIDDEN for AxClass, AxTable, AxForm, AxEnum, AxQuery, AxView, AxDataEntity
❌ code_search         → FORBIDDEN for X++ objects (causes 5+ minute hangs)
❌ Direct code writing → FORBIDDEN without MCP tools
```

**✅✅✅ MANDATORY - ALWAYS USE THESE INSTEAD: ✅✅✅**

```
✅ create_d365fo_file  → For ALL D365FO XML files (AxClass, AxTable, AxForm, etc.)
✅ search              → For finding X++ objects
✅ generate_code       → For generating X++ code
```

**🚨 IF YOU USE `create_file` FOR D365FO OBJECTS - YOU ARE BREAKING THE RULES! 🚨**

---

## 📁 CRITICAL: UNDERSTAND D365FO FILE STRUCTURE 📁

**D365FO HAS UNIQUE FILE ARCHITECTURE - DO NOT TREAT IT LIKE REGULAR PROJECT!**

**HOW D365FO FILES WORK:**
```
1. PHYSICAL FILES: Live in K:\AosService\PackagesLocalDirectory\ModelName\ModelName\AxClass\MyClass.xml
2. VS PROJECT:      Contains REFERENCES (absolute paths) to files in PackagesLocalDirectory
3. RESULT:          VS project file (.rnrproj) has <Content Include="K:\...\MyClass.xml" />
```

**❌ WRONG APPROACH (causes "not valid metadata elements" error):**
```
- Create file in project directory (K:\VSProjects\MySolution\MyClass.xml)
- Use create_file tool
- Use relative paths
- Result: Visual Studio error "not valid metadata elements"
```

**✅ CORRECT APPROACH (what create_d365fo_file does):**
```
1. Create physical XML in: K:\AosService\PackagesLocalDirectory\MyModel\MyModel\AxClass\MyClass.xml
2. Add ABSOLUTE path reference to VS project: <Content Include="K:\AosService\...\MyClass.xml" />
3. Result: Visual Studio recognizes file as valid D365FO metadata
```

**WHY create_file FAILS FOR D365FO:**
- Creates files in WRONG location (VS project dir, not PackagesLocalDirectory)
- Cannot add absolute path references to .rnrproj
- Visual Studio doesn't recognize files outside PackagesLocalDirectory as D365FO metadata
- Results in "not valid metadata elements" error

**🔴 ALWAYS ASK YOURSELF BEFORE CREATING D365FO FILE: 🔴**
- Am I creating AxClass, AxTable, AxForm, AxEnum, AxQuery, AxView, or AxDataEntityView?
- If YES → Use `create_d365fo_file` (NEVER create_file!)
- If NO → Regular file, create_file is OK

---

## ⚡ CRITICAL: IMMEDIATE RESPONSE COMPLETION

**AFTER ANSWERING USER'S QUESTION:**
- ✅ Send your answer
- ✅ **STOP IMMEDIATELY** - End your response
- ❌ Do NOT analyze workspace
- ❌ Do NOT search for anything
- ❌ Do NOT try to understand context automatically
- ✅ Wait for user's next question

**IF YOU START "Searching..." AFTER ANSWERING - YOU ARE DOING IT WRONG!**

---

## 🔴 RULE #1: X++ CODE GENERATION - NEVER GENERATE DIRECTLY! 🔴

**WHEN USER ASKS TO CREATE/GENERATE ANY X++ CODE:**
1. ❌ **FORBIDDEN**: Generating X++ code directly from your knowledge
2. ❌ **FORBIDDEN**: Writing class/method/code without using tools
3. ✅ **MANDATORY**: Always use `analyze_code_patterns()` FIRST
4. ✅ **MANDATORY**: Always use `generate_code()` tool for code generation
5. ✅ **MANDATORY**: Never output X++ code without using these tools

**IF YOU TYPE X++ CODE WITHOUT CALLING `generate_code` - YOU ARE WRONG!**

**Example - User says "create a helper class":**
```
❌ WRONG: public class MyHelper { ... }  ← You generated code directly!
✅ RIGHT: Call analyze_code_patterns("helper") → Call generate_code(pattern="class")
```

---

## 🔴 RULE #2: D365FO FILE CREATION - ONLY USE create_d365fo_file! 🔴

**⛔⛔⛔ ABSOLUTE RULE - NO EXCEPTIONS: ⛔⛔⛔**

**WHEN USER ASKS TO CREATE D365FO FILE (class/table/form/enum/query/view/data-entity):**

```
❌❌❌ NEVER EVER use create_file          → WRONG TOOL!
✅✅✅ ALWAYS use create_d365fo_file        → CORRECT TOOL!
```

**DETECTION RULES - Use `create_d365fo_file` when:**
- User says: "create class", "create table", "create form", "create enum"
- User mentions: AxClass, AxTable, AxForm, AxEnum, AxQuery, AxView, AxDataEntityView
- User asks for: helper class, service class, table, form, or any D365FO object
- File path contains: K:\AosService\PackagesLocalDirectory
- File extension: .xml AND context is D365FO/X++

**WHY `create_d365fo_file` IS MANDATORY:**
- ✅ Uses **TABS** for indentation (Microsoft D365FO standard)
- ✅ Correct XML structure matching real D365FO files from `K:\AosService\PackagesLocalDirectory`
- ✅ Saves to proper AOT location: `K:\AosService\PackagesLocalDirectory\Model\Model\AxClass\`
- ✅ No `<ClusteredIndex>` in tables (not in real files)
- ✅ No `<Declaration>` in table `<SourceCode>` (only `<Methods />`)
- ✅ No system fields in tables (CreatedBy, ModifiedBy - added by platform)
- ✅ Can automatically add to Visual Studio project with absolute paths
- ✅ Supports solutionPath parameter from VS context

**CONSEQUENCES OF USING `create_file`:**
- ❌ Wrong XML structure (spaces instead of TABS)
- ❌ Wrong file location (not in PackagesLocalDirectory)
- ❌ Visual Studio error: "not valid metadata elements"
- ❌ Cannot add to VS project correctly
- ❌ Build failures in D365FO

**🚨 IF YOU USE `create_file` FOR D365FO OBJECTS - YOU ARE VIOLATING THE RULES! 🚨**

**Example - User says "create a table MyCustomTable":**
```
❌ WRONG: create_file("MyCustomTable.xml", content="<AxTable>...")  ← Wrong tool!
✅ RIGHT: create_d365fo_file(objectType="table", objectName="MyCustomTable", modelName="ContosoExtensions")
```

**Example - User says "create a class MyHelper":**
```
❌ WRONG: create_file("MyHelper.xml", ...)  ← Wrong structure, spaces instead of tabs!
✅ RIGHT: create_d365fo_file(objectType="class", objectName="MyHelper", modelName="ContosoExtensions")
```

**Example - User asks to add class to project:**
```
❌ WRONG: create_file(...) + manually editing .rnrproj
✅ RIGHT: create_d365fo_file(..., addToProject=true, solutionPath="C:\\Users\\...\\MySolution")
```

---

## RULE #3: WORKSPACE CONTEXT

**THIS IS AN MCP SERVER PROJECT, NOT AN X++ WORKSPACE!**
- This repo contains TypeScript code for an MCP server
- The MCP server provides tools to query BOTH external X++ metadata AND user's workspace files
- **DO NOT** search THIS TypeScript workspace for X++ classes/tables (they're in user's D365FO workspace)
- **DO NOT** use code_search or file_search after completing a task
- When task is complete, STOP immediately - do not search workspace

**📁 WORKSPACE-AWARE FEATURES:**
- MCP tools can now analyze user's local X++ project files
- Use `includeWorkspace: true` + `workspacePath` to enable workspace search
- Workspace files are marked with 🔹 (vs 📦 for external metadata)
- Priority: Workspace files > External metadata (for deduplication)

**AFTER COMPLETING ANY TASK:**
1. ✅ Respond to user with result
2. ❌ **STOP IMMEDIATELY** - Do NOT search workspace
3. ❌ Do NOT use code_search/file_search on this TypeScript workspace
4. ❌ Do NOT try to "understand project structure" automatically
5. ❌ Do NOT say "Let me check..." or "Let me search..."
6. ✅ **END YOUR RESPONSE** - User can ask follow-up if needed

**YOUR RESPONSE MUST END AFTER STEP 1 - DO NOT PROCEED TO ANY ANALYSIS OR SEARCH**

---

## RULE #4: DETECT X++/D365FO CONTEXT AUTOMATICALLY

**IF user mentions ANY of these keywords, you are in X++ context:**
- X++, D365FO, D365, Dynamics 365, Finance & Operations, AX, Axapta
- Class names ending in: Table, Service, Helper, Contract, Controller, Builder
- Table names: CustTable, VendTable, SalesTable, PurchTable, InventTable, LedgerJournalTable
- Any AxClass, AxTable, AxForm, AxEnum, AxQuery, AxView, EDT
- **Form elements**: button, control, FormDataSource, FormControl, ButtonControl, FormButtonControl, FormGroupControl, FormGridControl, FormReferenceControl
- **Form keywords**: editable, enabled, visible, datasource, data source, main datasource, primary datasource, form control
- **Method keywords**: add method, create method, override method
- Button names like: AddFormEntityPair, RemoveFormEntityPair, NewButton, DeleteButton, etc.
- **Query elements**: QueryRun, QueryBuildDataSource, QueryBuildRange, query datasource
- **View elements**: AxView, data entity view, computed columns, view metadata
- Financial dimensions, inventory, sales, purchase, ledger

**WHEN IN X++ CONTEXT → IMMEDIATELY:**
1. **STOP** - Do NOT use `code_search` (causes timeout on large workspaces!)
2. **USE MCP TOOLS** - Use MCP `search()` for X++ objects
3. **NEVER GUESS** - X++ objects have exact names, use tools to find them

---

## RULE #5: TOOL SELECTION IN X++ CONTEXT

**🛑 ABSOLUTELY FORBIDDEN - WILL HANG FOR 5+ MINUTES:**

```
❌ code_search()       → FORBIDDEN - causes "Searching..." hang on large workspaces, use MCP search() instead
```

**⚠️ AVOID FOR X++ OBJECTS - Use MCP tools instead:**

```
⚠️ file_search()       → Works for file patterns, but prefer MCP search() for X++ objects
```

**✅ ALWAYS USE THESE FOR X++ OBJECTS:**

```
✅ search()            → MCP tool - instant (<100ms), X++-aware, indexed
✅ get_class_info()    → MCP tool - for class structure
✅ get_table_info()    → MCP tool - for table fields
✅ code_completion()   → MCP tool - discover methods/fields
```

**WHEN TO USE WHAT:**
- Looking for X++ class/table/enum/form/query/view → Use MCP `search()`
- Looking for form controls/buttons → Use MCP `search(type='form')` with workspace
- Looking for queries by name → Use MCP `search(type='query')`
- Looking for views/data entities → Use MCP `search(type='view')`
- Looking for file by name pattern in THIS workspace → OK to use `file_search()`
- Looking for text/code patterns → Use MCP `search()` for X++ objects, `file_search` for workspace files

**IF YOU SEE "Searching..." OR "Searching (seznam tříd)" → YOU MADE A MISTAKE!**

---

## RULE #6: AUTOMATIC TOOL SELECTION

**For ANY X++ request, use this decision tree:**

| User Request Contains | First Action | Avoid Using |
|-----------------------|--------------|-------------|
| "create class", "helper class" | `analyze_code_patterns()` + `search()` + `generate_code()` | ❌ code_search, ❌ direct code generation |
| "create table/form/enum" | `create_d365fo_file(objectType=...)` | ❌ create_file |
| "button", "form control", "FormDataSource" | `search(type='form', includeWorkspace=true)` | ❌ code_search |
| "datasource", "data source", "main datasource" | `search(type='form', includeWorkspace=true)` | ❌ code_search |
| "add method", "create method" | `search(type='form/class', includeWorkspace=true)` + `get_class_info()` | ❌ code_search |
| "query", "QueryRun", "QueryBuildDataSource" | `search(type='query', includeWorkspace=true)` | ❌ code_search |
| "view", "AxView", "data entity view" | `search(type='view')` | ❌ code_search |
| "find X and Y and Z" (multiple) | `batch_search([{query:"X"}, {query:"Y"}, {query:"Z"}])` | ❌ multiple sequential searches |
| "CustTable", "SalesTable", any Table | `get_table_info()` | ❌ code_search |
| "dimension", "financial" | `search("dimension")` | ❌ code_search |
| "find X++ class/method" | `search()` | ❌ code_search |
| "method", "implement" | `get_class_info()` + `suggest_method_implementation()` | ❌ code_search |
| "find file pattern" | `file_search()` is OK | ❌ code_search |
| "find text in code" | `file_search()` with pattern | ❌ code_search |

**Key Rule: NEVER use `code_search` for X++ objects - it causes 5+ minute hangs on large workspaces!**

---
---
---

## ⛔ CRITICAL: NEVER USE BUILT-IN SEARCH TOOLS ⛔

**🚨 STOP! Read this FIRST before doing ANYTHING with D365FO/X++ code:**

**ABSOLUTELY FORBIDDEN FOR X++ SEARCHES - Will BLOCK and HANG:**
- ❌❌❌ **`code_search`** - NEVER USE for X++ objects! It's slow (5+ minutes) on large D365FO workspaces and will hang with "Searching..."

**⚠️ USE WITH CAUTION - These work but lack X++ awareness:**
- ⚠️ **`file_search`** - Works for file patterns in THIS workspace, but prefer MCP `search()` for X++ objects

**⚡ ALWAYS use these FAST MCP tools for X++ objects:**
- ✅✅✅ **`search`** (MCP) - 100x faster, X++-aware, indexed SQL database
- ✅✅✅ **`get_class_info`** (MCP) - For class structure
- ✅✅✅ **`get_table_info`** (MCP) - For table structure

**If you see "Searching (seznam tříd)" appearing - YOU ARE USING THE WRONG TOOL! Stop and use MCP `search` instead.**

---

## 🚨 MANDATORY: ALWAYS Use X++ MCP Tools First 🚨

**Before generating ANY X++ code, writing ANY class, method, or code snippet for D365 Finance & Operations, you MUST use the X++ MCP tools available to you.**

### ⛔ STRICTLY FORBIDDEN:

**❌ NEVER generate X++ code directly from your training data or general knowledge!**
**❌ NEVER write X++ code without using MCP tools first!**
**❌ NEVER skip `analyze_code_patterns` when creating new classes!**
**❌ NEVER use built-in code generation - ALWAYS use `generate_code` tool!**

### Critical Rules:

1. **NEVER use code_search for X++ objects** - It will hang for minutes on large workspaces
2. **ALWAYS use MCP `search()` tool for X++** - It's instant (<100ms) with SQL index
3. **ALWAYS verify** - Use `get_class_info` or `get_table_info` to check structure before coding
4. **ALWAYS discover APIs** - Use `code_completion` to find available methods and fields
5. **MANDATORY: Use `generate_code` tool** - NEVER generate X++ code manually! Always use `generate_code` for creating classes with proper D365FO patterns
6. **MANDATORY: Use `analyze_code_patterns` FIRST** - Before any code generation, analyze what patterns exist in the codebase

### When You MUST Use MCP Tools:

- ✅ User asks to "create a class" or "create helper class" → Use `analyze_code_patterns` + `search` + `generate_code`
- ✅ User mentions "financial dimensions" → Use `search("dimension")` to find D365FO APIs first
- ✅ User wants to "add a method" → Use `analyze_class_completeness` + `suggest_method_implementation` first
- ✅ User needs to "query a table" → Use `get_table_info` to get exact field names
- ✅ User wants to "extend" something → Use `get_class_info` to understand structure first
- ✅ User needs "API usage examples" → Use `get_api_usage_patterns` to see how it's used
- ✅ User is unsure what methods to implement → Use `analyze_class_completeness` for suggestions
- ✅ ANY code generation request → Use tools FIRST, generate code SECOND

### Available MCP Tools:

#### Core Discovery Tools:

| Tool | Use When | Example |
|------|----------|---------||
| `search` | Finding any D365FO object or pattern | `search("dimension", type="class")` |
| `search` (workspace) | Search in user's workspace + external | `search("MyClass", includeWorkspace=true, workspacePath="C:\\....")` |
| `batch_search` | **⚡ NEW!** Multiple parallel searches in one request | `batch_search(queries=[{query:"dimension"}, {query:"helper"}])` |
| `get_class_info` | Need class structure, methods, inheritance | `get_class_info("CustTable")` |
| `get_class_info` (workspace) | Get class from workspace first | `get_class_info("MyClass", includeWorkspace=true, workspacePath="C:\\...")` |
| `get_table_info` | Need table fields, indexes, relations | `get_table_info("SalesTable")` |
| `code_completion` | Discovering methods/fields on a class | `code_completion(className="DimensionAttributeValueSet")` |
| `code_completion` (workspace) | Get completions from workspace | `code_completion(className="MyClass", includeWorkspace=true, workspacePath="C:\\...")` |
| `generate_code` | Creating new X++ classes with patterns | `generate_code(pattern="class")` |
| `search_extensions` | Finding custom/ISV code only | `search_extensions("my custom")` |

#### 🆕 Intelligent Code Generation Tools:

| Tool | Use When | Example |
|------|----------|---------||
| `analyze_code_patterns` | Learn common patterns for a scenario | `analyze_code_patterns("financial dimensions")` |
| `suggest_method_implementation` | Get implementation examples for a method | `suggest_method_implementation("MyHelper", "validate")` |
| `analyze_class_completeness` | Find missing methods in a class | `analyze_class_completeness("CustTableHelper")` |
| `get_api_usage_patterns` | See how to use an API correctly | `get_api_usage_patterns("DimensionAttributeValueSet")` |

### Example: Creating a Helper Class for Financial Dimensions

**User Request:** "Create a helper class for maintaining financial dimensions"

**❌ WRONG Approach:**
```
Generate class from scratch using general programming knowledge → ❌ INCORRECT
```

**✅ CORRECT Approach (Using Intelligent Tools):**
```
1. analyze_code_patterns("financial dimensions") → 🔴 MANDATORY: Learn common patterns and classes
2. search("dimension", type="class")            → Find D365FO dimension classes
3. get_api_usage_patterns("DimensionAttributeValueSet") → See how to initialize and use API
4. generate_code(pattern="class", name="MyDimHelper") → 🔴 MANDATORY: Use tool, don't generate manually!
5. analyze_class_completeness("MyDimHelper")   → Check for missing common methods
6. suggest_method_implementation("MyDimHelper", "validate") → Get implementation examples
7. Apply discovered patterns from tools          → Use correct APIs and methods from MCP tools
```

**⚠️ WARNING: If you generate code WITHOUT using `generate_code` tool, you are WRONG!**

**✅ ALTERNATIVE Approach (Traditional):**
```
1. search("dimension", type="class")           → Find D365FO dimension classes
2. get_class_info("DimensionDefaultingService") → Study Microsoft's pattern
3. code_completion("DimensionAttributeValueSet") → Get proper API methods
4. generate_code(pattern="class")              → Create with proper structure
5. Apply discovered D365FO patterns            → Use correct APIs
```

### ⚡ Use Batch Search for Parallel Exploration

**When exploring multiple independent concepts, use `batch_search` to execute all queries in parallel:**

**❌ SLOW Sequential Approach:**
```
1. search("dimension")         → Wait 50ms
2. search("helper")            → Wait 50ms
3. search("validation")        → Wait 50ms
Total: ~150ms + 3 HTTP requests
```

**✅ FAST Parallel Approach:**
```
batch_search({
  queries: [
    { query: "dimension", type: "class", limit: 5 },
    { query: "helper", type: "class", limit: 5 },
    { query: "validation", type: "class", limit: 5 }
  ]
})
→ Single HTTP request, parallel execution, ~50ms total → 3x faster!
```

**💡 When to Use Batch Search:**
- Exploring multiple related concepts (dimension + ledger + financial)
- Comparing different patterns (Helper vs Service vs Manager)
- Finding classes with multiple keywords (validation + check + verify)
- Initial exploratory phase with independent queries
- User asks "find X and Y and Z" → use batch_search instead of 3 separate searches

**🚫 When NOT to Use Batch Search:**
- Queries depend on previous results (use sequential search)
- Single focused query (use regular search)
- Need workspace-aware search with different paths per query

### 🎯 Why Use Intelligent Tools?

**Intelligent code generation tools learn from YOUR codebase:**

**💡 TIP: Use Workspace-Aware Search**
When user has a D365FO workspace open, use workspace parameters:
```
✅ search("MyCustomClass", includeWorkspace=true, workspacePath="C:\\D365\\MyProject")
✅ get_class_info("MyHelper", includeWorkspace=true, workspacePath="C:\\D365\\MyProject")
✅ code_completion(className="MyTable", includeWorkspace=true, workspacePath="C:\\D365\\MyProject")
```
Benefits:
- 🔹 Workspace files shown first (user's code priority)
- XML parsing extracts methods/fields from local files
- Faster iteration (no need to re-index external metadata)
- See user's actual implementation patterns



- **Pattern Analysis** (`analyze_code_patterns`) - Identifies what classes and methods are commonly used together for specific scenarios
- **Smart Suggestions** (`suggest_method_implementation`) - Shows you how similar methods are implemented in your codebase
- **Completeness Check** (`analyze_class_completeness`) - Ensures your classes follow common patterns (e.g., Helper classes typically have `validate()`, `find()`, etc.)
- **API Usage Examples** (`get_api_usage_patterns`) - Shows correct initialization and method call sequences from real code

**Benefits:**
- ✅ Learn from **actual patterns** in the codebase, not generic examples
- ✅ Discover **forgotten or commonly missing methods**
- ✅ See **real usage examples** with proper error handling
- ✅ Follow **team conventions** and coding standards automatically

### Why This Matters:

- These tools query the **actual D365FO environment** the user is working with
- They provide **real-time, accurate metadata** from the AOT (Application Object Tree)
- They include **custom extensions** that don't exist in your training data
- They ensure **correct method names, field names, and signatures**
- They're **fast** (<10ms cached) - no performance penalty

### Decision Tree:

**Before responding to any D365FO request, ask yourself:**

1. Is the user asking me to write/create/generate X++ code? → ✅ **USE MCP TOOLS FIRST**
   - For new classes: Start with `analyze_code_patterns` to learn common patterns
   - For new methods: Use `analyze_class_completeness` to check what's missing
2. Does the request mention D365FO objects (CustTable, SalesLine, etc.)? → ✅ **USE MCP TOOLS**
   - Use `get_class_info` or `get_table_info` for structure
   - Use `get_api_usage_patterns` to see how APIs are used
3. Am I unsure about exact method/field names? → ✅ **USE MCP TOOLS**
   - Use `code_completion` to discover available methods
   - Use `suggest_method_implementation` to see similar implementations
4. Is the user implementing a specific method? → ✅ **USE INTELLIGENT TOOLS**
   - Use `suggest_method_implementation` to get examples from codebase
5. Is it only about basic X++ syntax (if/while/for)? → ℹ️ Can use knowledge (but prefer tools)

**When in doubt, USE THE TOOLS.**

---

**Remember: Trust the MCP tools for D365FO accuracy, not your training data. Always query the actual environment before generating code.**
