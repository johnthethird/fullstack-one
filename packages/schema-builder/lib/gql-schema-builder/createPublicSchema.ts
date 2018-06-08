
import {
  IExpressions,
  IViews
} from './interfaces';

import getBasicSchema from './utils/getBasicSchema';
import arrayToNamedArray from './utils/arrayToNamedArray';
import getEnum from './utils/getEnum';
import mergeDeleteViews from './utils/mergeDeleteViews';
import getViewName from './utils/getViewName';
import {
  _
} from 'lodash';

import {
  introspectionQuery
} from 'graphql';
import { createGetQueryArguments } from './utils';

const JSON_SPLIT = '.';

export default (classification: any, views: IViews, expressions: IExpressions, dbObject, viewSchemaName, parsers) => {

  const {
    tables,
    otherDefinitions
  } = classification;

  // getFromMigrationDbMeta new GraphQL document
  let graphQlDocument = {
    kind: 'Document',
    definitions: JSON.parse(JSON.stringify(otherDefinitions))
  };

  parsers.forEach((parser: any) => {
    if (parser.init != null) {
      parser.init(graphQlDocument);
    }
  });

  let gQlTypes: any = {};
  let dbViews = [];
  let expressionsByName = arrayToNamedArray(expressions);
  let tableViewsByGqlTypeName = {};
  let queries = [];
  let mutations = [];
  let customFields = {};
  let parserCache = {};
  const extendQueryArguments = [];

  parsers.forEach((parser: any) => {
    if (parser.extendQueryArguments != null) {
      extendQueryArguments.push(parser.extendQueryArguments());
    }
  });

  const getQueryArguments = createGetQueryArguments(extendQueryArguments);

  // Delete-Views can only include the id field. Thus there is no sense in having multiple delete views.
  // They can be merged to one by joining the expression arrays.
  const filteredViews = mergeDeleteViews(views);

  // iterate over views
  // each view will become a view
  Object.values(filteredViews).forEach((view) => {
    if (view.gqlTypeName == null) {
      throw new Error('`gqlTypeName` is missing in a view.');
    }
    const gqlTypeName = view.gqlTypeName;
    const nativeTable = dbObject.exposedNames[gqlTypeName];
    const tableName = nativeTable.tableName;
    const schemaName = nativeTable.schemaName;
    const tableView = JSON.parse(JSON.stringify(tables[gqlTypeName]));
    const viewName = getViewName(view);
    view.viewName = viewName;
    view.tableName = tableName;
    tableView.name.value = viewName;

    if (view.type === 'UPDATE' && view.fields.indexOf('id') < 0) {
      throw new Error('A update view is required to include field "id". Please check view "' + view.gqlTypeName + '".');
    }

    const dbView: any = {
      gqlTypeName,
      tableName,
      schemaName,
      viewName,
      viewSchemaName,
      type: 'VIEW',
      fields: [],
      expressions: [],
      operation: view.type
    };

    // Create gQl Type for Table if it not already exists
    if (gQlTypes[gqlTypeName] == null) {
      gQlTypes[gqlTypeName] = {
        gqlTypeName,
        fieldNames: [],
        viewNames: [],
        authViewNames: [],
        noAuthViewNames: [],
        noRootLevelAggViewNames: [],
        views: {},
        relationByField: {}
      };
    }

    // Add current type to list
    gQlTypes[gqlTypeName].views[viewName] = {
      viewName,
      viewSchemaName,
      operation: view.type,
      nativeFieldNames: []
    };

    if (view.type === 'READ') {
      gQlTypes[gqlTypeName].viewNames.push(viewName);
      gQlTypes[gqlTypeName].noAuthViewNames.push(viewName);
    } else {
      tableView.kind = 'GraphQLInputObjectType';
    }

    // filter required dbViews
    // only allow fields which are included in the schema
    const tableViewFields = tableView.fields;
    tableView.fields = [];

    // rename table to view
    Object.values(tableView.directives).forEach((directive: any) => {
      if (directive.name.value === 'table') {
        directive.name.value = 'view';
      }
    });

    const ctx = {
      view,
      tableView,
      gQlTypes,
      dbView,
      customFields,
      queries,
      mutations,
      expressionsByName,
      schemaName,
      viewSchemaName,
      dbObject,
      graphQlDocument,
      parserCache,
      getQueryArguments
    };

    // Get fields and it's expressions
    Object.values(tableViewFields).forEach((field: any) => {
      parsers.some((parser: any) => {
        if (parser.parseField != null) {
          return parser.parseField(field, ctx);
        }
        return false;
      });
    });

    parsers.forEach((parser: any) => {
      if (parser.parseView != null) {
        parser.parseView(ctx);
      }
    });

    // Add dbView to dbViews
    dbViews.push(ctx.dbView);
    mutations = ctx.mutations;
    queries = ctx.queries;
    graphQlDocument = ctx.graphQlDocument;
    customFields = ctx.customFields;
    parserCache = ctx.parserCache;

    if (view.type === 'READ') {
      if (tableViewsByGqlTypeName[gqlTypeName] == null) {
        tableViewsByGqlTypeName[gqlTypeName] = [];
      }

      tableViewsByGqlTypeName[gqlTypeName].push(ctx.tableView);
    }
  });

  const finishCtx = {
    graphQlDocument,
    dbViews,
    queries,
    mutations,
    customFields,
    gQlTypes,
    expressionsByName,
    tableViewsByGqlTypeName,
    parserCache
  };

  parsers.forEach((parser: any) => {
    if (parser.finish != null) {
      parser.finish(finishCtx);
    }
  });

  graphQlDocument = finishCtx.graphQlDocument;
  dbViews = finishCtx.dbViews;
  queries = finishCtx.queries;
  mutations = finishCtx.mutations;
  customFields = finishCtx.customFields;
  gQlTypes = finishCtx.gQlTypes;
  expressionsByName = finishCtx.expressionsByName;
  tableViewsByGqlTypeName = finishCtx.tableViewsByGqlTypeName;
  parserCache = finishCtx.parserCache;

  // build GraphQL gQlTypes based on DB dbViews
  Object.values(gQlTypes).forEach((gQlType: any) => {

    const gqlTypeName = gQlType.gqlTypeName;
    const viewsEnumName = (gqlTypeName + '_VIEWS').toUpperCase();
    const table = tables[gQlType.gqlTypeName];

    // new object: GraphQL definition for fusionView
    const tableView = JSON.parse(JSON.stringify(table));

    tableView.name.value = gQlType.gqlTypeName;
    tableView.fields = [];

    const alreadyAddedFieldNames = [];

    tableViewsByGqlTypeName[gqlTypeName].forEach((tempTableView) => {
      tempTableView.fields.forEach((field) => {
        if (alreadyAddedFieldNames.indexOf(field.name.value) < 0) { // gQlType.fieldNames.indexOf(field.name.value) >= 0 &&
          alreadyAddedFieldNames.push(field.name.value);
          tableView.fields.push(field);
        }
      });
    });
    tableView.fields = tableView.fields.map((field, key) => {
      // Remove NonNullType because a field can be NULL if a user has no views
      if (field.type.kind === 'NonNullType') {
        field.type = field.type.type;
      }

      return field;
    });

    // Add views-enum definition of table to graphQlDocument
    graphQlDocument.definitions.push(getEnum(viewsEnumName, gQlType.viewNames));

    // Add table type to graphQlDocument
    graphQlDocument.definitions.push(tableView);

    queries.push({
      name: gqlTypeName.toString().toLowerCase() + 's',
      type: gqlTypeName,
      viewsEnumName: (gqlTypeName + '_VIEWS').toUpperCase()
    });
  });

  const basicSchema = getBasicSchema(queries, mutations, getQueryArguments);

  graphQlDocument.definitions = graphQlDocument.definitions.concat(basicSchema);

  const returnCtx = {
    document: graphQlDocument,
    dbViews,
    gQlTypes,
    queries,
    mutations,
    customFields
  };

  parsers.forEach((parser: any) => {
    if (parser.return != null) {
      parser.return(returnCtx);
    }
  });

  return returnCtx;
};
