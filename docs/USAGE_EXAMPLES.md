# D365FO MCP Server - Usage Examples

Practical examples for X++ code completion and symbol lookup in Visual Studio Code with GitHub Copilot.

## Table of Contents

- [Code Completion](#code-completion)
- [Symbol Search](#symbol-search)
- [Class & Table Information](#class--table-information)
- [Form, Query & View Analysis](#form-query--view-analysis)
- [Method Signatures & References](#method-signatures--references)
- [Extension Development](#extension-development)
- [Code Generation](#code-generation)
- [File Operations](#file-operations)
- [Pattern Analysis & Intelligent Code Generation](#pattern-analysis--intelligent-code-generation)
- [Configuration](#configuration)

---

## Code Completion

The primary purpose of this MCP server is to provide intelligent code completion for X++ development.

### Finding Methods on a Class

**Scenario:** You're working with `SalesTable` and need to find the right method.

```
What methods are available on SalesTable that relate to totals?
```

**Returns:** `updateSalesOrderTotals()`, `calcTotals()`, `initFromSalesLine()` with signatures and return types.

---

### Getting Field Names for a Table

**Scenario:** Writing a query and need exact field names.

```
List all fields on CustTable
```

**Returns:** All 200+ fields with types (e.g., `AccountNum` (EDT: CustAccount, Mandatory: Yes))

---

## Symbol Search

Fast full-text search across all X++ symbols.

### Finding Classes by Functionality

**Scenario:** Need to find classes related to posting sales invoices.

```
Search for classes related to sales invoice posting
```

**Returns:** `SalesInvoiceJournalPost`, `SalesInvoiceController`, `CustInvoiceJour` (relevance-ranked)

---

## Class & Table Information

### Understanding Class Hierarchy

**Scenario:** Before extending a class, you need to understand its inheritance.

```
Show me the inheritance hierarchy for SalesFormLetter
```

**Returns:**
```
SalesFormLetter → FormLetter → RunBase → Object
```

---

### Getting Table Relations

**Scenario:** Understanding foreign keys before writing joins.

```
Show me all relations on SalesLine
```

**Returns:** Relations to `SalesTable`, `InventTable`, `InventDim` with delete actions

---

### Getting Enum Values

**Scenario:** Need to know all possible values for a status field.

```
Show me all values in CustAccountType enum
```

**Returns:**
```
CustAccountType (Extensible: ✅)
Values:
- Customer = 0          (Regular customer account)
- Prospect = 1          (Prospective customer)
- Organization = 2      (Organization account)
- Person = 3           (Individual person account)
```

---

## Form, Query & View Analysis

### Analyzing Form Structure

**Scenario:** You need to understand a form before extending it.

```
Show me the structure of SalesTable form
```

**Returns:**
```
Form: SalesTable

DataSources:
- SalesTable (main)
  - Fields: SalesId, CustAccount, SalesName, ...
  - Methods: validateWrite(), active(), executeQuery()
- SalesLine (detail)
  - Link: SalesId -> SalesTable.SalesId
  - Methods: validateWrite(), modified()

Controls:
- ButtonNew (FormButtonControl)
- ButtonDelete (FormButtonControl)
- SalesLineGrid (FormGridControl)
- CustomerLookup (FormReferenceControl -> CustTable)

Methods:
- init() - Initialize form
- run() - Execute form
- closeOk() - Save and close
```

**Use Cases:**
- Finding buttons to extend (CoC)
- Understanding datasource relationships
- Locating form methods for overriding

---

### Analyzing Query Structure

**Scenario:** You need to understand a query before modifying it.

```
Analyze structure of CustTransOpenQuery
```

**Returns:**
```
Query: CustTransOpenQuery

Primary DataSource: CustTrans
- Table: CustTrans
- Fetch Mode: 1:n (One-to-Many)
- Join Mode: InnerJoin

Ranges:
- AccountNum (field: AccountNum, EDT: CustAccount)
- TransDate (field: TransDate, EDT: TransDate)
- AmountCur (field: AmountCur, EDT: AmountCur)

Child DataSources:
- CustTable (parent link)
  Link: AccountNum -> CustTrans.AccountNum
  
Total: 1 datasource, 3 ranges
```

**Use Cases:**
- Understanding query filters before modification
- Finding datasources to add/modify
- Analyzing join relationships

---

### Analyzing View/Data Entity Structure

**Scenario:** You need to understand a data entity for OData integration.

```
Show me structure of GeneralJournalAccountEntryView
```

**Returns:**
```
View: GeneralJournalAccountEntryView
Type: Data Entity View
Public: ✅
Read-Only: ✅

Mapped Fields (15):
- RecId -> GeneralJournalEntry.RecId
- JournalNum -> GeneralJournalEntry.JournalNum
- AccountNum -> LedgerDimension.DisplayValue
- TransDate -> GeneralJournalEntry.TransDate

Computed Fields (3):
- BalanceAmount (calculated from DebitAmount - CreditAmount)
- AccountType (derived from LedgerDimension)
- CurrencyCode (derived from Company)

Relations:
- GeneralJournalEntry (1:1 relation)
- LedgerDimension (n:1 relation)

Methods:
- init()
- validateWrite()
```

**Use Cases:**
- OData/integration development
- Understanding computed vs mapped fields
- Data migration planning

---

## Method Signatures & References

### Extracting Method Signatures for Extensions

**Scenario:** You need the exact signature to create a Chain of Command extension.

```
Get method signature for SalesTable.validateWrite()
```

**Returns:**
```
public boolean validateWrite(boolean _checkRelations = true)

Parameters:
- _checkRelations (boolean, optional, default: true)

Return Type: boolean

Extension Template:
[ExtensionOf(tableStr(SalesTable))]
final class SalesTable_Extension
{
    public boolean validateWrite(boolean _checkRelations = true)
    {
        boolean ret = next validateWrite(_checkRelations);
        // Your code here
        return ret;
    }
}
```

**Use Cases:**
- Creating CoC extensions with correct signatures
- Understanding optional parameters
- Ensuring type-safe method overrides

---

### Finding Where Code Is Used

**Scenario:** You need to know where a method is called before changing it.

```
Find all usages of DimensionAttributeValueSet.createForLedgerDimension()
```

**Returns:**
```
Found 45 usages in your codebase:

📦 LedgerJournalEngine.validateDimensions()
   Line 245: dimValueSet = DimensionAttributeValueSet::createForLedgerDimension(...);
   
📦 CustTable.setDefaultDimension()
   Line 89: defaultDim = DimensionAttributeValueSet::createForLedgerDimension(recId);
   
📦 SalesTable.validateFinancialDimensions()
   Line 156: dimSet = DimensionAttributeValueSet::createForLedgerDimension(this.DefaultDimension);
   
... (showing top 50 results)
```

**Another Example: Finding Field References**

```
Find references to SalesLine.RemainSalesPhysical field
```

**Returns:**
```
Found 23 field references:

📦 SalesLineCopy.copy()
   Line 78: salesLineCopy.RemainSalesPhysical = salesLine.RemainSalesPhysical;
   
📦 SalesQuantity.updateFromPacking()
   Line 145: this.RemainSalesPhysical -= qtyPacked;
```

**Use Cases:**
- Impact analysis before changes
- Understanding dependencies
- Refactoring safety checks
- Finding deprecated code usage

---

## Extension Development

### Chain of Command Pattern

**Scenario:** Need to extend the `insert` method on `CustTable`.

```
How do I use Chain of Command to extend CustTable.insert()?
```

**Returns:**
```xpp
[ExtensionOf(tableStr(CustTable))]
final class CustTable_Extension
{
    public void insert()
    {
        // Pre-logic
        next insert();
        // Post-logic
    }
}
```

---

### Event Handler Pattern

**Scenario:** Need to react when a sales order is validated.

```
Show me how to create an event handler for SalesTable onValidatedWrite
```

**Returns:**
```xpp
public class SalesTable_EventHandler
{
    [DataEventHandler(tableStr(SalesTable), DataEventType::ValidatedWrite)]
    public static void SalesTable_onValidatedWrite(Common sender, DataEventArgs e)
    {
        SalesTable salesTable = sender as SalesTable;
        // Your logic here
    }
}
```

---

## Code Generation

### Runnable Class

```
Generate a runnable class for customer data cleanup
```

**Returns:** Complete runnable class with `main()`, `run()`, dialog parameters, and info logging.

---

### Batch Job with SysOperation

```
Create a batch job for processing open sales orders
```

**Returns:** Controller class, Service class, Data contract class, and Batch job registration.

---

### Creating Physical D365FO Files

**Scenario:** You need to create a new helper class as a physical XML file in the AOT structure.

```
Create a helper class file named MyDimensionHelper in CustomCore model
```

**Returns:** Creates XML file at `K:\AosService\PackagesLocalDirectory\CustomCore\CustomCore\AxClass\MyDimensionHelper.xml`

**Advanced Example:** Create class with source code

```
Create a helper class MyDimensionHelper in CustomCore with the following code:
public class MyDimensionHelper extends RunBaseBatch
{
    public void run()
    {
        // TODO: Implement dimension logic
    }
}
```

**Other Object Types:**

```
Create a table MyCustomTable in CustomCore model
Create an enum MyStatusEnum in CustomCore model
Create a form MyCustomForm in CustomCore model
Create a data entity MyDataEntity in CustomCore model
```

**What Gets Created:**
- ✅ Physical XML file with proper D365FO metadata structure
- ✅ Saved in correct AOT location (AxClass, AxTable, AxEnum, etc.)
- ✅ Ready to be added to Visual Studio project

**🆕 Advanced: Automatic Project Integration**

```
Create a helper class MyDimensionHelper in CustomCore and add it to my project at K:\MyProjects\CustomCore\CustomCore.rnrproj
```

**What This Does:**
- ✅ Creates physical XML file in AOT structure
- ✅ Automatically adds file reference to .rnrproj
- ✅ Creates folder structure in project (Classes\, Tables\, etc.)
- ✅ Ready for immediate build (just reload project in VS)

**Next Steps After Creation:**

*Without Project Integration:*
1. Add file to Visual Studio project (Right-click project → Add Existing Item)
2. Build project to synchronize

*With Project Integration (addToProject=true):*
1. Reload project in Visual Studio (close/reopen or Unload/Reload project)
2. Build project to synchronize
3. Refresh AOT to see the object

---

### Editing Existing D365FO Files

**Scenario:** You need to add a method to an existing class without manually editing XML.

```
Add method calculateDiscount() to MyCustomHelper class in file K:\AosService\PackagesLocalDirectory\CustomCore\CustomCore\AxClass\MyCustomHelper.xml
```

**What Happens:**
- ✅ Automatic backup created (MyCustomHelper.xml.bak)
- ✅ XML parsed and validated
- ✅ New method added to `<Methods>` section
- ✅ XML validated after changes
- ✅ File saved atomically

**Returns:**
```
✅ Backup created: MyCustomHelper.xml.bak
✅ Added method: calculateDiscount()
✅ XML validated successfully
✅ Changes saved

Summary:
- 1 method added
- 0 fields modified
- File size: 2.3 KB -> 2.5 KB
```

**Another Example: Adding a Field to Table**

```
Add field CreditStatus (EDT: CustCreditStatus) to MyCustomTable in K:\AosService\...\AxTable\MyCustomTable.xml
```

**Safety Features:**
- Automatic `.bak` backup before any change
- XML validation ensures no corruption
- Automatic rollback on error
- Reports what changed (added, modified, deleted)

**Use Cases:**
- Adding methods to existing classes
- Adding fields to tables
- Modifying properties atomically
- Safe batch modifications with rollback

---

## Pattern Analysis & Intelligent Code Generation

New intelligent tools that learn from your codebase to provide smart suggestions and pattern-based code generation.

### Analyzing Code Patterns

**Scenario:** You need to implement financial dimension handling but don't know which classes and patterns to use.

```
Analyze code patterns for financial dimensions
```

**Returns:**
- Common classes used together (DimensionAttributeValueSet, DimensionStorage, etc.)
- Typical dependencies and relationships
- Frequency analysis showing most-used patterns
- Example code snippets from your codebase

---

### Getting Implementation Suggestions

**Scenario:** You're creating a helper class and need to implement a `validate()` method.

```
Suggest implementation for validate method in my DimensionHelper class
```

**Returns:**
- Similar validate methods from your codebase
- Implementation patterns (error handling, parameter validation, etc.)
- Complete code examples with complexity analysis

**Common Method Patterns:**
- `validate*` - Returns boolean, includes error handling
- `find*` - Query patterns with null checks
- `create*` - Initialization and insertion patterns with tts
- `update*` - Modification patterns with ttsbegin/ttscommit
- `delete*` - Cleanup patterns with cascade logic

---

### Analyzing Class Completeness

**Scenario:** You created a new `CustTableHelper` class and want to ensure it follows common patterns.

```
Analyze my CustTableHelper class for completeness
```

**Returns:**
- List of existing methods in your class
- Suggested missing methods based on similar Helper classes
- Importance ranking (🔴 Very common, 🟠 Common, 🟡 Somewhat common)

**Example Output:**
```
🔴 validate: Found in 85% of similar classes (17/20)
🟠 checkMandatoryFields: Found in 65% of similar classes (13/20)
🟡 copyToClipboard: Found in 35% of similar classes (7/20)
```

---

### Getting API Usage Patterns

**Scenario:** You need to use `DimensionAttributeValueSet` but don't know the correct initialization sequence.

```
Show me how to use DimensionAttributeValueSet API
```

**Returns:**
- Common initialization patterns
- Typical method call sequences
- Complete working examples from your codebase
- Related APIs often used together

**Example Output:**
```xpp
// Typical initialization
DimensionAttributeValueSet valueSet;
DimensionAttribute attribute;

attribute = DimensionAttribute::findByName('Department');
valueSet = DimensionAttributeValueSet::construct();

// Common method sequence
valueSet.addDimension(attribute, dimensionValue);
valueSet.save();
```

---

### Combining Intelligent Tools - Complete Workflow

**Example:** Creating a new posting service

1. **Analyze patterns:** `Analyze code patterns for inventory posting`  
   → Identifies `InventMovement`, `InventUpd_*`, `TmpInventTransMark`

2. **Check completeness:** `Analyze my InventPostingService class for completeness`  
   → Suggests: `validateBeforePost`, `createJournal`, `updateInventory`

3. **Get implementation:** `Suggest implementation for validateBeforePost`  
   → Shows similar validation methods with error handling

4. **Learn API usage:** `Show me how to use InventMovement API`  
   → Provides initialization patterns and method sequences

---

## Configuration

### MCP Client Setup (`.mcp.json`)

```json
{
  "servers": {
    "xpp-completion": {
      "url": "https://your-app.azurewebsites.net/mcp/",
      "description": "X++ Code Completion Server"
    }
  }
}
```

### Extension Prefix Configuration (`.env`)

```env
# Your custom model prefixes for filtering
EXTENSION_PREFIX=ISV_
CUSTOM_MODELS=ISV_Sales,ISV_Inventory
EXTRACT_MODE=custom
```

### Searching Custom Extensions Only

```
Search my custom ISV_ extensions for sales modifications
```

Filters results to only your custom models - useful when you have 500+ standard models indexed.

---

## File Creation

### Cloud Deployment (Recommended for Azure)

**Scenario:** MCP server runs in Azure (cloud) - need to create D365FO files remotely.

**Workflow:**
1. Generate XML content using `generate_d365fo_xml`
2. GitHub Copilot creates file using built-in `create_file`

```
Create a helper class MyDimensionHelper in CustomCore model
```

**Behind the scenes:**
```typescript
// Step 1: Generate XML (cloud-ready)
generate_d365fo_xml({
  objectType: "class",
  objectName: "MyDimensionHelper",
  modelName: "CustomCore"
})
// Returns XML content with TABS

// Step 2: Copilot creates file
create_file({
  filePath: "K:\\AosService\\PackagesLocalDirectory\\CustomCore\\CustomCore\\AxClass\\MyDimensionHelper.xml",
  content: xmlContent
})
```

**Why this workflow:**
- Works when MCP server runs in Azure/cloud (Linux)
- No file system access needed on server side
- Copilot creates file on user's local Windows D365FO VM

---

### Local Deployment (Windows only)

**Scenario:** MCP server runs locally on Windows D365FO development VM.

**Workflow:**
1. Single tool call - full automation

```
Create a table MyCustomTable in CustomCore model
```

**Behind the scenes:**
```typescript
// One-step automation (Windows only)
create_d365fo_file({
  objectType: "table",
  objectName: "MyCustomTable",
  modelName: "CustomCore",
  addToProject: true,
  projectPath: "C:\\D365\\MySolution\\MySolution.rnrproj"
})
// Creates file + adds to VS project automatically
```

**Platform requirements:**
- Requires local Windows with K:\ drive access
- Does NOT work in Azure/cloud deployment

---

## Tips for Effective Use

### Be Specific
- ❌ `Find customer stuff`  
- ✅ `Find methods on CustTable for updating credit limit`

### Use Exact Names When Known
- ❌ `sales table class`  
- ✅ `SalesTable` or `SalesFormLetter`

### Combine Queries
```
Show me SalesTable relations and generate a query to join with CustTable
```

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [CUSTOM_EXTENSIONS.md](CUSTOM_EXTENSIONS.md) - ISV configuration
- [SETUP.md](SETUP.md) - Installation guide
