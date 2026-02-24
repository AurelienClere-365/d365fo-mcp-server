/**
 * Smart XML Builder
 * Helper class for building D365FO XML structures (AxTable, AxForm)
 * with proper formatting and structure
 */

export interface TableFieldSpec {
  name: string;
  edt?: string;
  type?: string;
  mandatory?: boolean;
  label?: string;
}

export interface TableIndexSpec {
  name: string;
  fields: string[];
  unique?: boolean;
  clustered?: boolean;
}

export interface TableRelationSpec {
  name: string;
  targetTable: string;
  constraints: Array<{ field: string; relatedField: string }>;
}

export interface FormDataSourceSpec {
  name: string;
  table: string;
  allowEdit?: boolean;
  allowCreate?: boolean;
  allowDelete?: boolean;
}

export interface FormControlSpec {
  name: string;
  type: 'Grid' | 'Group' | 'String' | 'Int64' | 'Real' | 'Date' | 'DateTime' | 'Button' | 'ActionPane';
  properties?: Record<string, string>;
  children?: FormControlSpec[];
}

export class SmartXmlBuilder {
  /**
   * Build AxTable XML with fields, indexes, and relations
   */
  buildTableXml(spec: {
    name: string;
    label?: string;
    tableGroup?: string;
    fields: TableFieldSpec[];
    indexes?: TableIndexSpec[];
    relations?: TableRelationSpec[];
  }): string {
    const { name, label, tableGroup, fields, indexes, relations } = spec;

    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<AxTable xmlns:i="http://www.w3.org/2001/XMLSchema-instance">\n`;
    xml += `\t<Name>${name}</Name>\n`;
    
    if (label) {
      xml += `\t<Label>${this.escapeXml(label)}</Label>\n`;
    }
    
    xml += `\t<TableGroup>${tableGroup || 'Main'}</TableGroup>\n`;
    xml += `\t<TitleField1></TitleField1>\n`;
    xml += `\t<TitleField2></TitleField2>\n`;

    // Fields
    if (fields.length > 0) {
      xml += `\t<Fields>\n`;
      for (const field of fields) {
        xml += this.buildTableField(field);
      }
      xml += `\t</Fields>\n`;
    } else {
      xml += `\t<Fields />\n`;
    }

    // Indexes
    if (indexes && indexes.length > 0) {
      xml += `\t<Indexes>\n`;
      for (const index of indexes) {
        xml += this.buildTableIndex(index);
      }
      xml += `\t</Indexes>\n`;
    } else {
      xml += `\t<Indexes />\n`;
    }

    // Relations
    if (relations && relations.length > 0) {
      xml += `\t<Relations>\n`;
      for (const relation of relations) {
        xml += this.buildTableRelation(relation);
      }
      xml += `\t</Relations>\n`;
    } else {
      xml += `\t<Relations />\n`;
    }

    xml += `</AxTable>\n`;
    return xml;
  }

  /**
   * Build AxForm XML with datasources and controls
   */
  buildFormXml(spec: {
    name: string;
    label?: string;
    caption?: string;
    dataSources: FormDataSourceSpec[];
    controls?: FormControlSpec[];
  }): string {
    const { name, label, caption, dataSources, controls } = spec;

    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<AxForm xmlns:i="http://www.w3.org/2001/XMLSchema-instance">\n`;
    xml += `\t<Name>${name}</Name>\n`;
    
    if (label) {
      xml += `\t<Label>${this.escapeXml(label)}</Label>\n`;
    }
    
    if (caption) {
      xml += `\t<TitleDatasource>${this.escapeXml(caption)}</TitleDatasource>\n`;
    }

    // DataSources
    if (dataSources.length > 0) {
      xml += `\t<DataSources>\n`;
      for (const ds of dataSources) {
        xml += this.buildFormDataSource(ds);
      }
      xml += `\t</DataSources>\n`;
    } else {
      xml += `\t<DataSources />\n`;
    }

    // Design
    xml += `\t<Design>\n`;
    if (controls && controls.length > 0) {
      for (const control of controls) {
        xml += this.buildFormControl(control, 2);
      }
    }
    xml += `\t</Design>\n`;

    xml += `</AxForm>\n`;
    return xml;
  }

  /**
   * Build table field XML node
   */
  private buildTableField(field: TableFieldSpec): string {
    const { name, edt, type, mandatory, label } = field;

    // Determine field node type
    let nodeType = 'AxTableFieldString'; // default
    
    if (edt) {
      // Try to infer from EDT name
      const edtLower = edt.toLowerCase();
      if (edtLower.includes('int') || edtLower.includes('num')) {
        nodeType = 'AxTableFieldInt';
      } else if (edtLower.includes('real') || edtLower.includes('amount')) {
        nodeType = 'AxTableFieldReal';
      } else if (edtLower.includes('date')) {
        nodeType = 'AxTableFieldDate';
      } else if (edtLower.includes('datetime')) {
        nodeType = 'AxTableFieldUtcDateTime';
      } else if (edtLower.includes('enum')) {
        nodeType = 'AxTableFieldEnum';
      }
    } else if (type) {
      const typeMap: Record<string, string> = {
        'String': 'AxTableFieldString',
        'Integer': 'AxTableFieldInt',
        'Int64': 'AxTableFieldInt64',
        'Real': 'AxTableFieldReal',
        'Date': 'AxTableFieldDate',
        'DateTime': 'AxTableFieldUtcDateTime',
        'Enum': 'AxTableFieldEnum',
        'Container': 'AxTableFieldContainer',
        'Guid': 'AxTableFieldGuid',
      };
      nodeType = typeMap[type] || 'AxTableFieldString';
    }

    let xml = `\t\t<${nodeType}>\n`;
    xml += `\t\t\t<Name>${name}</Name>\n`;
    
    if (edt) {
      xml += `\t\t\t<ExtendedDataType>${edt}</ExtendedDataType>\n`;
    }
    
    if (mandatory) {
      xml += `\t\t\t<Mandatory>Yes</Mandatory>\n`;
    }
    
    if (label) {
      xml += `\t\t\t<Label>${this.escapeXml(label)}</Label>\n`;
    }
    
    xml += `\t\t</${nodeType}>\n`;
    return xml;
  }

  /**
   * Build table index XML node
   */
  private buildTableIndex(index: TableIndexSpec): string {
    const { name, fields, unique, clustered } = index;

    let xml = `\t\t<AxTableIndex>\n`;
    xml += `\t\t\t<Name>${name}</Name>\n`;
    
    if (unique) {
      xml += `\t\t\t<AllowDuplicates>No</AllowDuplicates>\n`;
    }
    
    if (clustered) {
      xml += `\t\t\t<IsClustered>Yes</IsClustered>\n`;
    }

    xml += `\t\t\t<Fields>\n`;
    for (const fieldName of fields) {
      xml += `\t\t\t\t<AxTableIndexField>\n`;
      xml += `\t\t\t\t\t<DataField>${fieldName}</DataField>\n`;
      xml += `\t\t\t\t</AxTableIndexField>\n`;
    }
    xml += `\t\t\t</Fields>\n`;
    
    xml += `\t\t</AxTableIndex>\n`;
    return xml;
  }

  /**
   * Build table relation XML node
   */
  private buildTableRelation(relation: TableRelationSpec): string {
    const { name, targetTable, constraints } = relation;

    let xml = `\t\t<AxTableRelation>\n`;
    xml += `\t\t\t<Name>${name}</Name>\n`;
    xml += `\t\t\t<RelatedTable>${targetTable}</RelatedTable>\n`;
    
    xml += `\t\t\t<Constraints>\n`;
    for (const constraint of constraints) {
      xml += `\t\t\t\t<AxTableRelationConstraint>\n`;
      xml += `\t\t\t\t\t<Field>${constraint.field}</Field>\n`;
      xml += `\t\t\t\t\t<RelatedField>${constraint.relatedField}</RelatedField>\n`;
      xml += `\t\t\t\t</AxTableRelationConstraint>\n`;
    }
    xml += `\t\t\t</Constraints>\n`;
    
    xml += `\t\t</AxTableRelation>\n`;
    return xml;
  }

  /**
   * Build form datasource XML node
   */
  private buildFormDataSource(ds: FormDataSourceSpec): string {
    const { name, table, allowEdit, allowCreate, allowDelete } = ds;

    let xml = `\t\t<AxFormDataSourceRoot>\n`;
    xml += `\t\t\t<Name>${name}</Name>\n`;
    xml += `\t\t\t<Table>${table}</Table>\n`;
    
    if (allowEdit !== undefined) {
      xml += `\t\t\t<AllowEdit>${allowEdit ? 'Yes' : 'No'}</AllowEdit>\n`;
    }
    
    if (allowCreate !== undefined) {
      xml += `\t\t\t<AllowCreate>${allowCreate ? 'Yes' : 'No'}</AllowCreate>\n`;
    }
    
    if (allowDelete !== undefined) {
      xml += `\t\t\t<AllowDelete>${allowDelete ? 'Yes' : 'No'}</AllowDelete>\n`;
    }
    
    xml += `\t\t\t<Fields />\n`;
    xml += `\t\t</AxFormDataSourceRoot>\n`;
    return xml;
  }

  /**
   * Build form control XML node (recursive)
   */
  private buildFormControl(control: FormControlSpec, indentLevel: number): string {
    const { name, type, properties, children } = control;
    const indent = '\t'.repeat(indentLevel);

    const nodeType = `AxForm${type}`;
    let xml = `${indent}<${nodeType}>\n`;
    xml += `${indent}\t<Name>${name}</Name>\n`;

    // Add properties
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        xml += `${indent}\t<${key}>${this.escapeXml(value)}</${key}>\n`;
      }
    }

    // Add children recursively
    if (children && children.length > 0) {
      for (const child of children) {
        xml += this.buildFormControl(child, indentLevel + 1);
      }
    }

    xml += `${indent}</${nodeType}>\n`;
    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate primary key index for table
   */
  buildPrimaryKeyIndex(tableName: string, fields: string[]): TableIndexSpec {
    return {
      name: `${tableName}Idx`,
      fields,
      unique: true,
      clustered: false,
    };
  }

  /**
   * Generate form grid control with fields
   */
  buildGridControl(name: string, dataSource: string, fields: string[]): FormControlSpec {
    const gridChildren: FormControlSpec[] = fields.map(field => ({
      name: field,
      type: 'String',
      properties: {
        DataSource: dataSource,
        DataField: field,
      },
    }));

    return {
      name,
      type: 'Grid',
      properties: {
        DataSource: dataSource,
      },
      children: gridChildren,
    };
  }
}
