
export function parseReadField(ctx) {
  const { fieldName, readExpressions, directives } = ctx;

  // Has field any permission-expression
  if (readExpressions[fieldName] != null && directives.custom != null) {
    const { defaultFieldCreator } = ctx;

    const columnExpression = `NULL::text`;

    const {
      publicFieldSql,
      authFieldSql,
      gqlFieldDefinition
    } = defaultFieldCreator.create(readExpressions[fieldName], JSON.parse(JSON.stringify(ctx.gqlFieldDefinition)), columnExpression, fieldName);

    return [{
        gqlFieldName: fieldName,
        nativeFieldName: fieldName,
        publicFieldSql,
        authFieldSql,
        gqlFieldDefinition,
        isVirtual: true
      }];
  }
  return null;
}

export function parseUpdateField(ctx) {
  const { gqlFieldDefinition, view, fieldName, directives } = ctx;

  if (view.fields.indexOf(fieldName) >= 0 && directives.custom != null) {
    return [];
  }
  return null;
}

export function parseCreateField(ctx) {
  return parseUpdateField(ctx);
}
