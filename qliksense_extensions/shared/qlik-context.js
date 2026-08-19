/**
 * qlik-context.js
 * ===============
 * Resolves who is looking at the visual and which Qlik app it sits in, so each
 * visual can stamp when it was generated, by whom and from where.
 *
 * The lookups go through the Capability API and are cached for the lifetime of
 * the page. Every failure path resolves to blanks rather than rejecting, so a
 * locked-down server can never stop a chart from rendering.
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define(['qlik'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(null);
  } else {
    root.NhsMdcQlikContext = factory(root.qlik);
  }
}(typeof self !== 'undefined' ? self : this, function (qlik) {
  'use strict';

  var EMPTY = { user: '', appName: '', appId: '' };
  var cached = null;

  function pad(value) {
    return (value < 10 ? '0' : '') + value;
  }

  /** Local time as dd/MM/yyyy HH:mm, avoiding locale-dependent output. */
  function formatTimestamp(date) {
    var d = date || new Date();
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /**
   * Turn "UserDirectory=ABUHB; UserId=jsmith" into "ABUHB\jsmith". Anything
   * that does not match that shape is passed through unchanged.
   */
  function parseUser(raw) {
    if (!raw) { return ''; }
    var directory = /UserDirectory=([^;]+)/i.exec(raw);
    var userId = /UserId=([^;]+)/i.exec(raw);
    if (!userId) { return String(raw).trim(); }
    var name = userId[1].trim();
    return directory ? directory[1].trim() + '\\' + name : name;
  }

  function appTitleFrom(reply, app) {
    if (reply) {
      if (reply.qTitle) { return reply.qTitle; }
      if (reply.layout && reply.layout.qTitle) { return reply.layout.qTitle; }
    }
    if (app && app.model && app.model.layout && app.model.layout.qTitle) {
      return app.model.layout.qTitle;
    }
    return '';
  }

  function settled(promise, fallback) {
    if (!promise || typeof promise.then !== 'function') {
      return Promise.resolve(fallback);
    }
    return Promise.resolve(promise).then(null, function () { return fallback; });
  }

  /**
   * Resolve `{user, appName, appId}` for the current session.
   * @param {Object} [scope] The extension `this`, so the right app is found
   *   when the visual is embedded in a mashup.
   */
  function load(scope) {
    if (cached) { return cached; }
    if (!qlik || typeof qlik.currApp !== 'function') {
      cached = Promise.resolve(EMPTY);
      return cached;
    }

    var app;
    try {
      app = qlik.currApp(scope);
    } catch (error) {
      cached = Promise.resolve(EMPTY);
      return cached;
    }
    if (!app) {
      cached = Promise.resolve(EMPTY);
      return cached;
    }

    var titlePromise = settled(
      typeof app.getAppLayout === 'function' ? app.getAppLayout() : null, null
    );
    var userPromise = settled(
      app.global && typeof app.global.getAuthenticatedUser === 'function'
        ? app.global.getAuthenticatedUser() : null,
      null
    );

    cached = Promise.all([titlePromise, userPromise]).then(function (replies) {
      return {
        user: parseUser(replies[1] && replies[1].qReturn),
        appName: appTitleFrom(replies[0], app),
        appId: app.id || ''
      };
    }, function () {
      return EMPTY;
    });
    return cached;
  }

  /** One-line stamp: when the visual was generated, by whom, and where. */
  function stampText(context, date) {
    var ctx = context || EMPTY;
    var parts = ['Generated ' + formatTimestamp(date)];
    if (ctx.user) { parts.push(ctx.user); }
    if (ctx.appName) { parts.push(ctx.appName); }
    return parts.join(' \u2022 ');
  }

  return {
    load: load,
    stampText: stampText,
    formatTimestamp: formatTimestamp,
    parseUser: parseUser
  };
}));
