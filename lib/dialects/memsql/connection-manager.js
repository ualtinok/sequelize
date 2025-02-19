'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const Promise = require('../../promise');
const { logger } = require('../../utils/logger');
const DataTypes = require('../../data-types').memsql;
const momentTz = require('moment-timezone');
const debug = logger.debugContext('connection:memsql');
const parserStore = require('../parserStore')('memsql');

/**
 * MemSQL Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MemSQL specific connections
 * Use https://github.com/MemSQL/memsql-connector-nodejs to connect with MemSQL server
 *
 * @extends AbstractConnectionManager
 * @returns Class<ConnectionManager>
 * @private
 */

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    sequelize.config.port = sequelize.config.port || 3306;
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('mariadb');
    this.refreshTypeParser(DataTypes);
  }

  static _typecast(field, next) {
    if (parserStore.get(field.type)) {
      return parserStore.get(field.type)(field, this.sequelize.options, next);
    }
    return next();
  }

  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  /**
   * Connect with MemSQL database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param {Object} config
   * @returns {Promise<Connection>}
   * @private
   */
  connect(config) {
    // Named timezone is not supported in memsql, convert to offset
    let tzOffset = this.sequelize.options.timezone;
    tzOffset = /\//.test(tzOffset) ? momentTz.tz(tzOffset).format('Z')
      : tzOffset;

    const connectionConfig = {
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      timezone: tzOffset,
      typeCast: ConnectionManager._typecast.bind(this),
      bigNumberStrings: false,
      supportBigNumbers: true,
      foundRows: false
    };

    if (config.dialectOptions) {
      Object.assign(connectionConfig, config.dialectOptions);
    }

    if (!this.sequelize.config.keepDefaultTimezone) {
      // set timezone for this connection
      if (connectionConfig.initSql) {
        if (!Array.isArray(
          connectionConfig.initSql)) {
          connectionConfig.initSql = [connectionConfig.initSql];
        }
        connectionConfig.initSql.push(`SET time_zone = '${tzOffset}'`);
      } else {
        connectionConfig.initSql = `SET time_zone = '${tzOffset}'`;
      }
    }

    return this.lib.createConnection(connectionConfig)
      .then(connection => {
        this.sequelize.options.databaseVersion = connection.serverVersion();
        debug('connection acquired');
        connection.on('error', error => {
          switch (error.code) {
            case 'ESOCKET':
            case 'ECONNRESET':
            case 'EPIPE':
            case 'PROTOCOL_CONNECTION_LOST':
              this.pool.destroy(connection);
          }
        });
        return connection;
      })
      .catch(err => {
        switch (err.code) {
          case 'ECONNREFUSED':
            throw new SequelizeErrors.ConnectionRefusedError(err);
          case 'ER_ACCESS_DENIED_ERROR':
          case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
            throw new SequelizeErrors.AccessDeniedError(err);
          case 'ENOTFOUND':
            throw new SequelizeErrors.HostNotFoundError(err);
          case 'EHOSTUNREACH':
          case 'ENETUNREACH':
          case 'EADDRNOTAVAIL':
            throw new SequelizeErrors.HostNotReachableError(err);
          case 'EINVAL':
            throw new SequelizeErrors.InvalidConnectionError(err);
          default:
            throw new SequelizeErrors.ConnectionError(err);
        }
      });
  }

  disconnect(connection) {
    // Don't disconnect connections with CLOSED state
    if (!connection.isValid()) {
      debug('connection tried to disconnect but was already at CLOSED state');
      return Promise.resolve();
    }
    //wrap native Promise into bluebird
    return Promise.resolve(connection.end());
  }

  validate(connection) {
    return connection && connection.isValid();
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
