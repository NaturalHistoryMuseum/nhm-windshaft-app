/**
   Class used to generate PostgreSQL compatible SELECT SQL queries.

    In order to minimize the risk of wrongly escape identifiers or values, this generator
    enforces the following rules:

    - Both identifiers and values must be in ASCII. Non-ascii characters are stripped out;
    - Identifiers can only contain alphanumeric characters, underscores, dashes and spaces;
    - Values can only only contain alphanumeric characters, underscores, dashes and spaces.

    Available options:
      nl: Defaults to False. If True, will add a newline between each of the SQL query sections.
      compact: Defaults to False. If True, will remove all newlines and consecutive white spaces
               from expressions (but not from identifiers/values). This is not a parser - if you
               hand-code values into your expressions, those will get compacted too!

 */
function Select(options, identifiers, values) {
  this._global_context = [identifiers || {}, values || {}];
  this._options = {
    nl: false,
    compact: false
  };
  for (var attr in options){
    this._options[attr] = options[attr];
  }
  this._query = {
    from: [],
    inner_join: [],
    select: [],
    distinct_on: [],
    where: [],
    order_by: [],
    group_by: []
  };
}

/**
 * Generate the SQL represented by this query
 */
Select.prototype.to_sql = function(){
  // Ensure we have required sections
  if (this._query.from.length == 0){
    throw new Error("Missing FROM section");
  }
  if (this._query.select.length == 0){
    throw new Error("Missing SELECT section");
  }
  // Build select clause
  var query = [];
  query.push("SELECT");
  if (this._query.distinct_on.length > 0){
    query[0] = query[0] + " DISTINCT ON (" + this._sql_section('distinct_on').join(', ') + ")";
  }
  query[0] = query[0] + " " + this._sql_section('select').join(', ');
  query.push('FROM ' + this._sql_section('from').join(', '));
  if (this._query.inner_join.length > 0){
    for (var join in this._sql_section('inner_join')){
      query.push('INNER JOIN ' + join)
    }
  }
  if (this._query.where.length > 0){
    query.push('WHERE (' + this._sql_section('where').join(') AND (') + ')')
  }
  if (this._query.group_by.length > 0){
    query.push('GROUP BY ' + this._sql_section('group_by').join(', '))
  }
  if (this._query.order_by.length > 0){
    query.push('ORDER BY ' + this._sql_section('order_by').join(', '))
  }
  if (this._options.nl){
    return query.join("\n");
  } else {
    return query.join(" ");
  }
};

/**
 * Add a table/expression to the from clause of the query
 * @param expr: The from clause
 * @param identifiers: Dictionary of identifier label to value for the from clause only
 * @param values: Dictionary of value label to value for the form clause only
 * @return: Select object (this)
 */
Select.prototype.from = function(expr, identifiers, values){
  return this._add_expr('from', expr, identifiers, values);
};

/**
 * Add a table/expression to the inner join clause of the query
 * @param expr: The inner join clause
 * @param identifiers: Dictionary of identifier label to value for the inner join clause only
 * @param values: Dictionary of value label to value for the inner join clause only
 * @return: Select object (this)
 */
Select.prototype.inner_join = function(expr, identifiers, values){
  return this._add_expr('inner_join', expr, identifiers, values);
};

/**
 * Add a table/expression to the distinct on clause of the query
 * @param expr: The distinct on clause
 * @param identifiers: Dictionary of identifier label to value for the distinct on clause only
 * @param values: Dictionary of value label to value for the distinct on clause only
 * @return: Select object (this)
 */
Select.prototype.distinct_on = function(expr, identifiers, values){
  return this._add_expr('distinct_on', expr, identifiers, values);
};

/**
 * Add a table/expression to the select clause of the query
 * @param expr: The select clause
 * @param identifiers: Dictionary of identifier label to value for the select clause only
 * @param values: Dictionary of value label to value for the select clause only
 * @return: Select object (this)
 */
Select.prototype.select = function(expr, identifiers, values){
  return this._add_expr('select', expr, identifiers, values);
};

/**
 * Add a table/expression to the where clause of the query
 * @param expr: The where clause
 * @param identifiers: Dictionary of identifier label to value for the where clause only
 * @param values: Dictionary of value label to value for the where clause only
 * @return: Select object (this)
 */
Select.prototype.where = function(expr, identifiers, values){
  return this._add_expr('where', expr, identifiers, values);
};

/**
 * Add a table/expression to the order by clause of the query
 * @param expr: The order by clause
 * @param identifiers: Dictionary of identifier label to value for the order by clause only
 * @param values: Dictionary of value label to value for the order by clause only
 * @return: Select object (this)
 */
Select.prototype.order_by = function(expr, identifiers, values){
  return this._add_expr('order_by', expr, identifiers, values);
};

/**
 * Add a table/expression to the group_by clause of the query
 * @param expr: The group_by clause
 * @param identifiers: Dictionary of identifier label to value for the group_by clause only
 * @param values: Dictionary of value label to value for the group_by clause only
 * @return: Select object (this)
 */
Select.prototype.group_by = function(expr, identifiers, values){
  return this._add_expr('group_by', expr, identifiers, values);
};


/**
 * Generic function for adding a new expression to a part (from, where, etc.) of thee query
 *
 * @param type: from, select, where, order_by, group_by, distinct_on
 * @param expr: The expression
 * @param identifiers: Dictionary of identifier label to value for that expression
 * @param values: Dictionary of value label to valule for that expression
 * @return: Select object (this)
 */
Select.prototype._add_expr = function(part, expr, identifiers, values){
  var local_context = this._get_context(identifiers, values);
  this._query[part].push([expr, local_context]);
  return this;
};

/**
 * Create a context by expanding the default context with the given one
 *
 * @param identifiers: Dictionary of identifier label to value
 * @param values: Dictionary of valule label to value
 * @return: Array - Context defined as tuple of identifier dictionary and value dictionary
 */
Select.prototype._get_context = function(identifiers, values){
  var context_identifiers = {};
  var context_values = {};
  for (var i in this._global_context[0]){
    context_identifiers[i] = this._global_context[0][i];
  }
  if (identifiers) {
    for (var i in identifiers) {
      context_identifiers[i] = identifiers[i];
    }
  }
  for (var i in this._global_context[1]){
    context_values[i] = this._global_context[1][i];
  }
  if (values) {
    for (var i in values) {
      context_values[i] = values[i];
    }
  }
  return [context_identifiers, context_values];
};

/**
 * Get the escaped replacement strings from a given context
 *
 * @param context: Context tuple
 * @return: Object as dictionary of label to escaped identifier/value
 */
Select.prototype._get_replacements = function(context){
  var result = {};
  for (var label in context[0]){
    var val = context[0][label];
    if (Array.isArray(val)) {
      result[label] = '"' + this._clean_string(val[0]) + '"."' + this._clean_string(val[1]) + '"';
    } else {
      result[label] = '"' + this._clean_string(val) + '"';
    }
  }
  for (var label in context[1]){
    var val = context[1][label];
    if (typeof(val.to_sql) == 'function') {
      result[label] = val.to_sql();
    } else if (typeof(val) == 'number'){
      result[label] = val.toString();
    } else {
      result[label] = "'" + this._clean_string(val) + "'";
    }
  }
  return result;
};

/**
 * Return a list of expressions in the given section for the current query, with identifers and values replaced
 *
 * @param section: Section (from, select, where, etc.)
 * @return: Array of strings
 */
Select.prototype._sql_section = function(section) {
  var result = [];
  for (var i in this._query[section]){
    var s = this._query[section][i][0];
    if (this._options['compact']){
      s = s.replace(/[\s\n]+/g, ' ');
    }
    var replacements = this._get_replacements(this._query[section][i][1]);
    for (var label in replacements){
      var val = replacements[label];
      s = s.split('{' + label + '}').join(val);
    }
    result.push(s);
  }
  return result;
};

/**
 * Clean a string by ensuring it's an ascii string with characters in -_a-zA-Z0-9<space> only
 *
 * @param val: String to clean up
 * @return: String - the cleaned up string.
 */
Select.prototype._clean_string = function(val){
  return String(val).replace(/[^-_ 0-9a-zA-Z0-9.,()]/g, '')
};

module.exports = Select;