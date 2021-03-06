
export function parseUpdateField(ctx) {
  const { gqlFieldDefinition, view, fieldName } = ctx;

  if (fieldName === 'id' && view.fields.indexOf(fieldName) >= 0) {
    if (gqlFieldDefinition.type.kind !== 'NonNullType') {
      gqlFieldDefinition.type = {
        kind: 'NonNullType',
        type: gqlFieldDefinition.type
      };
    }
    return [gqlFieldDefinition];
  }
  return null;
}

export function parseCreateField(ctx) {
  const { gqlFieldDefinition, view, fieldName } = ctx;

  if (fieldName === 'id' && view.fields.indexOf(fieldName) >= 0) {
    if (gqlFieldDefinition.type.kind === 'NonNullType') {
      gqlFieldDefinition.type = gqlFieldDefinition.type.type;
    }
    return [gqlFieldDefinition];
  }
  return null;
}
