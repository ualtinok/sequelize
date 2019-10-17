'use strict';

const _ = require('lodash');
const moment = require('moment-timezone');

module.exports = BaseTypes => {
  BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://memsql.com/kb/en/library/resultset/#field-types';

  /**
   * types: [buffer_type, ...]
   * @see documentation : https://docs.memsql.com/v6.5/reference/sql-reference/datatypes/
   */

  BaseTypes.DATE.types.memsql = ['DATETIME'];
  BaseTypes.STRING.types.memsql = ['VAR_STRING'];
  BaseTypes.CHAR.types.memsql = ['STRING'];
  BaseTypes.TEXT.types.memsql = ['BLOB'];
  BaseTypes.TINYINT.types.memsql = ['TINY'];
  BaseTypes.SMALLINT.types.memsql = ['SHORT'];
  BaseTypes.MEDIUMINT.types.memsql = ['INT24'];
  BaseTypes.INTEGER.types.memsql = ['LONG'];
  BaseTypes.BIGINT.types.memsql = ['LONGLONG'];
  BaseTypes.FLOAT.types.memsql = ['FLOAT'];
  BaseTypes.TIME.types.memsql = ['TIME'];
  BaseTypes.DATEONLY.types.memsql = ['DATE'];
  BaseTypes.BOOLEAN.types.memsql = ['TINY'];
  BaseTypes.BLOB.types.memsql = ['TINYBLOB', 'BLOB', 'LONGBLOB'];
  BaseTypes.DECIMAL.types.memsql = ['NEWDECIMAL'];
  BaseTypes.UUID.types.memsql = false;
  BaseTypes.ENUM.types.memsql = false;
  BaseTypes.REAL.types.memsql = ['DOUBLE'];
  BaseTypes.DOUBLE.types.memsql = ['DOUBLE'];
  BaseTypes.GEOMETRY.types.memsql = ['GEOMETRY'];
  BaseTypes.JSON.types.memsql = ['JSON'];

  class DECIMAL extends BaseTypes.DECIMAL {
    toSql() {
      let definition = super.toSql();
      if (this._unsigned) {
        definition += ' UNSIGNED';
      }
      if (this._zerofill) {
        definition += ' ZEROFILL';
      }
      return definition;
    }
  }

  class DATE extends BaseTypes.DATE {
    toSql() {
      return `DATETIME${this._length ? `(${this._length})` : ''}`;
    }
    _stringify(date, options) {
      date = this._applyTimezone(date, options);
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    }
    static parse(value, options) {
      value = value.string();
      if (value === null) {
        return value;
      }
      if (moment.tz.zone(options.timezone)) {
        value = moment.tz(value, options.timezone).toDate();
      }
      else {
        value = new Date(`${value} ${options.timezone}`);
      }
      return value;
    }
  }

  class DATEONLY extends BaseTypes.DATEONLY {
    static parse(value) {
      return value.string();
    }
  }

  class UUID extends BaseTypes.UUID {
    toSql() {
      return 'CHAR(36) BINARY';
    }
  }

  class GEOMETRY extends BaseTypes.GEOMETRY {
    constructor(type, srid) {
      super(type, srid);
      if (_.isEmpty(this.type)) {
        this.sqlType = this.key;
      }
      else {
        this.sqlType = this.type;
      }
    }
    toSql() {
      return this.sqlType;
    }
  }

  class ENUM extends BaseTypes.ENUM {
    toSql(options) {
      return `ENUM(${this.values.map(value => options.escape(value)).join(', ')})`;
    }
  }

  class JSONTYPE extends BaseTypes.JSON {
    _stringify(value, options) {
      return options.operation === 'where' && typeof value === 'string' ? value
        : JSON.stringify(value);
    }
  }

  return {
    ENUM,
    DATE,
    DATEONLY,
    UUID,
    GEOMETRY,
    DECIMAL,
    JSON: JSONTYPE
  };
};
