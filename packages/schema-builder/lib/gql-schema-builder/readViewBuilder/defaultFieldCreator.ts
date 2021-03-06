
export class CreateDefaultField {
  private expressionCreator: any;

  constructor(expressionCreator) {
    this.expressionCreator = expressionCreator;
  }

  public create(readExpressionsField, gqlFieldDefinition, columnExpression, nativeFieldName) {
    let publicFieldSql = null;
    let authFieldSql = null;

    let hasPublicTrueExpression: any = false;

    const expressions = this.expressionCreator.parseExpressionInput(readExpressionsField);

    const getName = (expressionObject) => {
      return `"${expressionObject.name}"."${expressionObject.name}"`;
    };

    // Generate public condition out of array of expressions
    const publicCondition = expressions.filter((expressionObject) => {
      // If any expression is just true, the hole field is public
      if (expressionObject.sql.toLowerCase() === 'true') {
        hasPublicTrueExpression = true;
      }

      return expressionObject.requiresAuth !== true;
    }).map(getName).join(' OR ');

    // Generate condition out of array of expressions
    const authCondition = expressions.map(getName).join(' OR ');

    // If one expression is just true we don't need CASE (for public fields)
    if (hasPublicTrueExpression === true) {
      publicFieldSql = `${columnExpression} AS "${nativeFieldName}"`;
    } else {
      // Remove NonNullType by jumping to the next hierarchy level
      if (gqlFieldDefinition.type.kind === 'NonNullType') {
        gqlFieldDefinition.type = gqlFieldDefinition.type.type;
      }
      if (publicCondition !== '') {
        publicFieldSql = `CASE WHEN ${publicCondition} THEN ${columnExpression} ELSE NULL END AS "${nativeFieldName}"`;
      }
      authFieldSql = `CASE WHEN ${authCondition} THEN ${columnExpression} ELSE NULL END AS "${nativeFieldName}"`;
    }
    return {
      publicFieldSql,
      authFieldSql,
      gqlFieldDefinition
    };
  }
}
