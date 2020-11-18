'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _qs = require('qs');

var _deepmerge = require('deepmerge');

var _deepmerge2 = _interopRequireDefault(_deepmerge);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

var _jsonapiSerializer = require('jsonapi-serializer');

var _actions = require('./actions');

var _defaultSettings = require('./default-settings');

var _defaultSettings2 = _interopRequireDefault(_defaultSettings);

var _errors = require('./errors');

var _initializer = require('./initializer');

var _initializer2 = _interopRequireDefault(_initializer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/** This proxy ensures that every relationship is serialized to an object of the form {id: x}, even
 * if that relationship doesn't have included data
 */
var specialOpts = ['transform', 'keyForAttribute', 'id', 'typeAsAttribute', 'links'];
var relationshipProxyHandler = {
  has: function has(target, key) {
    // Pretend to have all keys except certain ones with special meanings
    if (specialOpts.includes(key)) {
      return key in target;
    }
    return true;
  },
  get: function get(target, key) {
    var fallback = target[key];

    // Use the fallback for special options
    if (specialOpts.includes(key)) {
      return fallback;
    }

    // Merge the fallback with this object for per-resource settings
    return Object.assign({
      valueForRelationship: function valueForRelationship(data, included) {
        // If we have actual included data use it, but otherwise just return the id in an object
        if (included) {
          return included;
        }

        return { id: data.id };
      }
    }, fallback || {});
  }
};

// Set HTTP interceptors.
(0, _initializer2.default)();

/**
 * Maps react-admin queries to a JSONAPI REST API
 *
 * @param {string} apiUrl the base URL for the JSONAPI
 * @param {Object} userSettings Settings to configure this client.
 *
 * @param {string} type Request type, e.g GET_LIST
 * @param {string} resource Resource name, e.g. "posts"
 * @param {Object} payload Request parameters. Depends on the request type
 * @returns {Promise} the Promise for a data response
 */

exports.default = function (apiUrl) {
  var userSettings = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  return function (type, resource, params) {
    var url = '';
    var settings = (0, _deepmerge2.default)(_defaultSettings2.default, userSettings);

    var options = {
      headers: settings.headers,
      withCredentials: true
    };

    function getSerializerOpts() {
      var resourceSpecific = settings.serializerOpts[resource] || {};

      // By default, assume the user wants to serialize all keys except links, in case that's
      // a leftover from a deserialized resource
      var attributes = new Set(Object.keys(params.data));
      attributes.delete('links');

      return Object.assign({
        attributes: [].concat(_toConsumableArray(attributes))
      }, resourceSpecific);
    }

    switch (type) {
      case _actions.GET_LIST:
        {
          var _query;

          var _params$pagination = params.pagination,
              page = _params$pagination.page,
              perPage = _params$pagination.perPage;

          // Create query with pagination params.

          var query = (_query = {}, _defineProperty(_query, settings.pagination.page, page), _defineProperty(_query, settings.pagination.perPage, perPage), _query);

          // Add all filter params to query.
          Object.keys(params.filter || {}).forEach(function (key) {
            query['filter[' + key + ']'] = params.filter[key];
          });

          // Add sort parameter
          if (params.sort && params.sort.field) {
            var prefix = params.sort.order === 'ASC' ? '' : '-';
            query.sort = '' + prefix + params.sort.field;
          }

          url = apiUrl + '/' + resource + '?' + (0, _qs.stringify)(query);
          break;
        }

      case _actions.GET_ONE:
        url = apiUrl + '/' + resource + '/' + params.id;
        break;

      case _actions.CREATE:
        url = apiUrl + '/' + resource;
        options.method = 'POST';
        options.data = new _jsonapiSerializer.Serializer(resource, getSerializerOpts()).serialize(params.data);
        break;

      case _actions.UPDATE:
        {
          url = apiUrl + '/' + resource + '/' + params.id;

          var data = Object.assign({ id: params.id }, params.data);

          options.method = settings.updateMethod;
          options.data = new _jsonapiSerializer.Serializer(resource, getSerializerOpts()).serialize(data);
          if (options.data && options.data.data && options.data.data.attributes && 'id' in options.data.data.attributes) {
            delete options.data.data.attributes.id;
          }

          break;
        }

      case _actions.DELETE:
        url = apiUrl + '/' + resource + '/' + params.id;
        options.method = 'DELETE';
        break;

      case _actions.GET_MANY:
        {
          var _query2 = (0, _qs.stringify)({
            'filter[id]': params.ids
          }, { arrayFormat: settings.arrayFormat });

          url = apiUrl + '/' + resource + '?' + _query2;
          break;
        }

      case _actions.GET_MANY_REFERENCE:
        {
          var _query4;

          var _params$pagination2 = params.pagination,
              _page = _params$pagination2.page,
              _perPage = _params$pagination2.perPage;

          // Create query with pagination params.

          var _query3 = (_query4 = {}, _defineProperty(_query4, settings.pagination.page, _page), _defineProperty(_query4, settings.pagination.perPage, _perPage), _query4);

          // Add all filter params to query.
          Object.keys(params.filter || {}).forEach(function (key) {
            _query3['filter[' + key + ']'] = params.filter[key];
          });

          // Add the reference id to the filter params.
          _query3['filter[' + params.target + ']'] = params.id;

          url = apiUrl + '/' + resource + '?' + (0, _qs.stringify)(_query3);
          break;
        }

      default:
        throw new _errors.NotImplementedError('Unsupported Data Provider request type ' + type);
    }

    return (0, _axios2.default)(_extends({ url: url }, options)).then(function (response) {
      var opts = new Proxy(settings.deserializerOpts[resource] || {}, relationshipProxyHandler);

      switch (type) {
        case _actions.GET_MANY:
        case _actions.GET_MANY_REFERENCE:
        case _actions.GET_LIST:
          {
            // Use the length of the data array as a fallback.
            var total = response.data.data.length;
            if (response.data.meta && settings.total) {
              total = response.data.meta[settings.total];
            }

            return new _jsonapiSerializer.Deserializer(opts).deserialize(response.data).then(function (data) {
              return { data: data, total: total };
            });
          }
        case _actions.GET_ONE:
        case _actions.CREATE:
        case _actions.UPDATE:
          {
            return new _jsonapiSerializer.Deserializer(opts).deserialize(response.data).then(function (data) {
              return { data: data };
            });
          }
        case _actions.DELETE:
          {
            return Promise.resolve({
              data: {
                id: params.id
              }
            });
          }

        default:
          throw new _errors.NotImplementedError('Unsupported Data Provider request type ' + type);
      }
    });
  };
};