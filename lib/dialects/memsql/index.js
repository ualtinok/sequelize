'use strict';

const _ = require('lodash');
const AbstractDialect = require('../abstract');
const ConnectionManager = require('./connection-manager');
const Query = require('./query');
const QueryGenerator = require('./query-generator');
const DataTypes = require('../../data-types').memsql;

class MemsqlDialect extends AbstractDialect {
  constructor(sequelize) {
    super();
    this.sequelize = sequelize;
    this.connectionManager = new ConnectionManager(this, sequelize);
    this.QueryGenerator = new QueryGenerator({
      _dialect: this,
      sequelize
    });
  }
}

MemsqlDialect.prototype.supports = _.merge(
  _.cloneDeep(AbstractDialect.prototype.supports), {
    'VALUES ()': true,
    'LIMIT ON UPDATE': true,
    lock: true,
    forShare: 'LOCK IN SHARE MODE',
    settingIsolationLevelDuringTransaction: false,
    schemas: true,
    inserts: {
      ignoreDuplicates: ' IGNORE',
      updateOnDuplicate: ' ON DUPLICATE KEY UPDATE'
    },
    index: {
      collate: false,
      length: true,
      parser: true,
      type: true,
      using: 1
    },
    constraints: {
      dropConstraint: false,
      check: false
    },
    indexViaAlter: true,
    NUMERIC: true,
    GEOMETRY: true,
    JSON: true,
    REGEXP: true
  });

ConnectionManager.prototype.defaultVersion = '5.5.3';
MemsqlDialect.prototype.Query = Query;
MemsqlDialect.prototype.QueryGenerator = QueryGenerator;
MemsqlDialect.prototype.DataTypes = DataTypes;
MemsqlDialect.prototype.name = 'memsql';
MemsqlDialect.prototype.TICK_CHAR = '`';
MemsqlDialect.prototype.TICK_CHAR_LEFT = MemsqlDialect.prototype.TICK_CHAR;
MemsqlDialect.prototype.TICK_CHAR_RIGHT = MemsqlDialect.prototype.TICK_CHAR;

module.exports = MemsqlDialect;
