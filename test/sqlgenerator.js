var Select = require("../lib/sqlgenerator.js");
var assert = require("assert");

describe('Select', function(){
  describe('minimum requirements to generate a query', function() {
    it('should raise if no select clause is defined', function () {
      var q = new Select();
      assert.throws(function () {
        q.to_sql();
      });
    });
    it('should raise if no from clause is defined', function () {
      var q = new Select();
      q.from('table');
      assert.throws(function () {
        q.to_sql();
      });
    });
    it('should raise if no from clause is defined', function () {
      var q = new Select();
      q.select('field');
      assert.throws(function () {
        q.to_sql();
      });
    });
  });
  describe('SQL generation', function(){
    it('should be possible to generate a query with only a from and select clause', function () {
      var q = new Select();
      q.select('field').from('table');
      assert.equal(q.to_sql(), "SELECT field FROM table");
    });
    it('should be possible to generate a query with all sections combined', function () {
      var q = new Select();
      q.select('field').distinct_on('another_field').from('table').where('number = 1')
      q.order_by('way ASC').group_by('group');
      assert.equal(q.to_sql(), "SELECT DISTINCT ON (another_field) field FROM table WHERE (number = 1) GROUP BY group ORDER BY way ASC");
    });
    it('should be possible to use multiple values for all sections of a query', function () {
      var q = new Select();
      q.select('field1').select('field2').distinct_on('fielda').distinct_on('fieldb').from('table1').from('table2');
      q.where('number1 = 1').where('number2 = 2').order_by('way1 ASC').order_by('way2 ASC');
      q.group_by('group1').group_by('group2');
      assert.equal(q.to_sql(), ["SELECT DISTINCT ON (fielda, fieldb) field1, field2 FROM table1, table2 WHERE (number1 = 1) AND (number2 = 2)",
        "GROUP BY group1, group2 ORDER BY way1 ASC, way2 ASC"].join(" "))
    });
  });
  describe('identifier replacement contexts', function(){
    it('should use the global identifier context in all sections of a query', function(){
      var q = new Select(null, {table: 'table_name', field: 'field_name'});
      q.select('{field}').distinct_on('{field}').from('{table}').where('{field} = 1').order_by('{field} ASC');
      q.group_by('{field}');
      assert.equal(q.to_sql(), 'SELECT DISTINCT ON ("field_name") "field_name" FROM "table_name" WHERE ("field_name" = 1) GROUP BY "field_name" ORDER BY "field_name" ASC');
    });
    it('should use the local identifier (which overrides the global one) context in all sections of a query', function(){
      var q = new Select(null, {table: 'table_name', field: 'field_name'});
      q.select('{field}').select('{field}', {field: 'another_field'});
      q.distinct_on('{field}').distinct_on('{field}', {field: 'another_field'});
      q.from('{table}').from('{table}', {table: 'another_table'});
      q.where('{field} = 1').where('{field} = 2', {field: 'another_field'});
      q.order_by('{field} ASC').order_by('{field} DESC', {field: 'another_field'});
      q.group_by('{field}').group_by('{field}', {field: 'another_field'});
      assert.equal(q.to_sql(), 'SELECT DISTINCT ON ("field_name", "another_field") "field_name", "another_field" FROM "table_name", "another_table" WHERE ("field_name" = 1) AND ("another_field" = 2) GROUP BY "field_name", "another_field" ORDER BY "field_name" ASC, "another_field" DESC');
    });
    it('should be possible to use an array for an identifier to specify table.field', function(){
      var q = new Select(null, {'field': ['t1', 'f1']});
      q.select('{field}').select('{field}', {field: ['t2', 'f2']});
      q.distinct_on('{field}').distinct_on('{field}', {field: ['t2', 'f2']});
      q.from('table');
      q.where('{field} = 1').where('{field} = 2', {field: ['t2', 'f2']});
      q.order_by('{field} ASC').order_by('{field} DESC', {field: ['t2', 'f2']});
      q.group_by('{field}').group_by('{field}', {field: ['t2', 'f2']});
      assert.equal(q.to_sql(), 'SELECT DISTINCT ON ("t1"."f1", "t2"."f2") "t1"."f1", "t2"."f2" FROM table WHERE ("t1"."f1" = 1) AND ("t2"."f2" = 2) GROUP BY "t1"."f1", "t2"."f2" ORDER BY "t1"."f1" ASC, "t2"."f2" DESC');
    });
  });
  describe('value replacement contexts', function(){
    it('should use the global value context in all relevant sections of a query', function(){
      var q = new Select(null, null, {'val1': 'carrot cake', 'val2': '32'});
      q.select('field').from('table').where('f1 = {val1}').where('f2 = {val2}');
      assert.equal(q.to_sql(), "SELECT field FROM table WHERE (f1 = 'carrot cake') AND (f2 = '32')");
    });
    it('should use the local value context (which should override the global one) in all relevant sections of a query', function(){
      var q = new Select(null, {}, {'val1': 'carrot cake'});
      q.select('field').from('table')
      q.where('f1 = {val1}').where('f2 = {val1}', {}, {val1: 'brownie'});
      assert.equal(q.to_sql(), "SELECT field FROM table WHERE (f1 = 'carrot cake') AND (f2 = 'brownie')");
    });
  });
  describe('value types', function(){
    it('should cast non-string values to strings for identifiers', function(){
      var q = new Select(null, {'field': 12});
      q.select('{field}').from('table');
      assert.equal(q.to_sql(), 'SELECT "12" FROM table');
    });
    it('should not quote numeric values (unless passed in as a string)', function(){
      var q = new Select(null, null, {'val1': '12', 'val2': 12, 'val3': 12.1});
      q.select('field').from('table').where('f1 = {val1}').where('f2 = {val2}').where('f3 = {val3}');
      assert.equal(q.to_sql(), "SELECT field FROM table WHERE (f1 = '12') AND (f2 = 12) AND (f3 = 12.1)");
    });
    it('should accept a query as a value', function(){
      var q1 = new Select();
      q1.select('f1').from('t1');
      var q2 = new Select(null, null, {'query': q1});
      q2.select('*').from('({query}) AS sub_query');
      assert.equal(q2.to_sql(), 'SELECT * FROM (SELECT f1 FROM t1) AS sub_query');
    });
  });
  describe('value and identifier escaping', function(){
    var valid = 'abcdefABCDEFxyzXYZ01239-_ (),.';
    var test1 = '"\'!"%&*;:@#~[]{}\\|/?<>' + valid;
    var test2 = 'ÃÆÔöğ' + String.fromCharCode(10) + valid;
    it('should escape identifier labels', function() {
      var q = new Select(null, {table: test1});
      q.select('{field}', {field: test2});
      q.from('{table}');
      assert.equal(q.to_sql(), 'SELECT "' + valid + '" FROM "' + valid + '"');
    });
    it('should escape values', function(){
      var q = new Select(null, null, {'v1': test1})
      q.select('field').from('table');
      q.where('f1 = {v1}').where('f2 = {v2}', null, {'v2': test2});
      assert.equal(q.to_sql(), 'SELECT field FROM table WHERE (f1 = \'' + valid + '\') AND (f2 = \'' + valid + '\')')
    });
  });
  describe('formatting options', function(){
    it('should insert newlines if nl is passed in and true', function() {
      var q = new Select({nl: true});
      q.select('field').distinct_on('another_field').from('table').where('number = 1').order_by('way ASC').group_by('group');
      assert.equal(q.to_sql(), "SELECT DISTINCT ON (another_field) field\nFROM table\nWHERE (number = 1)\nGROUP BY group\nORDER BY way ASC")
    });
    it('should not remove extra spaces and newlines if compact is not selected', function(){
      var q = new Select();
      q.select('field').from('table').where("n = 1 \n  AND   n = 2");
      assert.equal(q.to_sql(), "SELECT field FROM table WHERE (n = 1 \n  AND   n = 2)");
    });
    it('should remove extra spaces and newlines if compact is selected', function(){
      var q = new Select({compact: true});
      q.select('field').from('table').where("n = 1 \n  AND   n = 2");
      assert.equal(q.to_sql(), "SELECT field FROM table WHERE (n = 1 AND n = 2)");
    });
  });
});