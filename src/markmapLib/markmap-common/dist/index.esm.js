/*! markmap-common v0.1.5 | MIT License */
class Hook {
  constructor() {
    this.listeners = [];
  }

  tap(fn) {
    this.listeners.push(fn);
    return () => this.revoke(fn);
  }

  revoke(fn) {
    const i = this.listeners.indexOf(fn);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  revokeAll() {
    this.listeners.splice(0);
  }

  call(...args) {
    for (const fn of this.listeners) {
      fn(...args);
    }
  }

}

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

function escapeHtml(html) {
  return html.replace(/[&<"]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '"': '&quot;'
  })[m]);
}
function escapeScript(content) {
  return content.replace(/<(\/script>)/g, '\\x3c$2');
}
function htmlOpen(tagName, attrs) {
  const attrStr = attrs ? Object.entries(attrs).map(([key, value]) => {
    if (value == null || value === false) return;
    key = ` ${escapeHtml(key)}`;
    if (value === true) return key;
    return `${key}="${escapeHtml(value)}"`;
  }).filter(Boolean).join('') : '';
  return `<${tagName}${attrStr}>`;
}
function htmlClose(tagName) {
  return `</${tagName}>`;
}
function wrapHtml(tagName, content, attrs) {
  if (content == null) return htmlOpen(tagName, attrs);
  return htmlOpen(tagName, attrs) + (content || '') + htmlClose(tagName);
}
function wrapStyle(text, style) {
  if (style.code) text = wrapHtml('code', text);
  if (style.del) text = wrapHtml('del', text);
  if (style.em) text = wrapHtml('em', text);
  if (style.strong) text = wrapHtml('strong', text);
  return text;
}
function buildCode(fn, args) {
  const params = args.map(arg => {
    if (typeof arg === 'function') return arg.toString();
    return JSON.stringify(arg != null ? arg : null);
  }).join(',');
  return `(${fn.toString()})(${params})`;
}
function persistJS(items, context) {
  return items.map(item => {
    if (item.type === 'script') return wrapHtml('script', '', item.data);

    if (item.type === 'iife') {
      const {
        fn,
        getParams
      } = item.data;
      return wrapHtml('script', escapeScript(buildCode(fn, (getParams == null ? void 0 : getParams(context)) || [])));
    }

    return '';
  });
}
function persistCSS(items) {
  return items.map(item => {
    if (item.type === 'stylesheet') {
      return wrapHtml('link', null, _extends({
        rel: 'stylesheet'
      }, item.data));
    }
    /* else if (item.type === 'style') */


    return wrapHtml('style', item.data);
  });
}

const uniqId = Math.random().toString(36).slice(2, 8);
let globalIndex = 0;
function getId() {
  globalIndex += 1;
  return `mm-${uniqId}-${globalIndex}`;
}
function noop() {// noop
}
function walkTree(tree, callback, key = 'c') {
  const walk = (item, parent) => callback(item, () => {
    var _item$key;

    (_item$key = item[key]) == null ? void 0 : _item$key.forEach(child => {
      walk(child, item);
    });
  }, parent);

  walk(tree);
}
function arrayFrom(arrayLike) {
  if (Array.from) return Array.from(arrayLike);
  const array = [];

  for (let i = 0; i < arrayLike.length; i += 1) {
    array.push(arrayLike[i]);
  }

  return array;
}
function flatMap(arrayLike, callback) {
  if (arrayLike.flatMap) return arrayLike.flatMap(callback);
  const array = [];

  for (let i = 0; i < arrayLike.length; i += 1) {
    const result = callback(arrayLike[i], i, arrayLike);
    if (Array.isArray(result)) array.push(...result);else array.push(result);
  }

  return array;
}
function addClass(className, ...rest) {
  const classList = (className || '').split(' ').filter(Boolean);
  rest.forEach(item => {
    if (item && classList.indexOf(item) < 0) classList.push(item);
  });
  return classList.join(' ');
}
function childSelector(filter) {
  if (typeof filter === 'string') {
    const tagName = filter;

    filter = el => el.tagName === tagName;
  }

  const filterFn = filter;
  return function selector() {
    let nodes = arrayFrom(this.childNodes);
    if (filterFn) nodes = nodes.filter(node => filterFn(node));
    return nodes;
  };
}
function wrapFunction(fn, {
  before,
  after
}) {
  return function wrapped(...args) {
    const ctx = {
      args
    };

    try {
      if (before) before(ctx);
    } catch (_unused) {// ignore
    }

    ctx.result = fn(...args);

    try {
      if (after) after(ctx);
    } catch (_unused2) {// ignore
    }

    return ctx.result;
  };
}
function defer() {
  const obj = {};
  obj.promise = new Promise((resolve, reject) => {
    obj.resolve = resolve;
    obj.reject = reject;
  });
  return obj;
}
function memoize(fn) {
  const cache = {};
  return function memoized(...args) {
    const key = `${args[0]}`;
    let data = cache[key];

    if (!data) {
      data = {
        value: fn(...args)
      };
      cache[key] = data;
    }

    return data.value;
  };
}

function createElement(tagName, props, attrs) {
  const el = document.createElement(tagName);

  if (props) {
    Object.entries(props).forEach(([key, value]) => {
      el[key] = value;
    });
  }

  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
  }

  return el;
}

const memoizedPreloadJS = memoize(url => {
  document.head.append(createElement('link', {
    rel: 'preload',
    as: 'script',
    href: url
  }));
});

function loadJSItem(item, context) {
  if (item.type === 'script') {
    return new Promise((resolve, reject) => {
      var _item$data;

      document.head.append(createElement('script', _extends({}, item.data, {
        onload: resolve,
        onerror: reject
      }))); // Run inline script synchronously

      if (!((_item$data = item.data) != null && _item$data.src)) resolve();
    });
  }

  if (item.type === 'iife') {
    const {
      fn,
      getParams
    } = item.data;
    fn(...((getParams == null ? void 0 : getParams(context)) || []));
  }
}

function loadCSSItem(item) {
  if (item.type === 'style') {
    document.head.append(createElement('style', {
      textContent: item.data
    }));
  } else if (item.type === 'stylesheet') {
    document.head.append(createElement('link', _extends({
      rel: 'stylesheet'
    }, item.data)));
  }
}

async function loadJS(items, context) {
  const needPreload = items.filter(item => {
    var _item$data2;

    return item.type === 'script' && ((_item$data2 = item.data) == null ? void 0 : _item$data2.src);
  });
  if (needPreload.length > 1) needPreload.forEach(item => memoizedPreloadJS(item.data.src));
  context = _extends({
    getMarkmap: () => window.markmap
  }, context);

  for (const item of items) {
    await loadJSItem(item, context);
  }
}
function loadCSS(items) {
  for (const item of items) {
    loadCSSItem(item);
  }
}

export { Hook, addClass, arrayFrom, buildCode, childSelector, defer, escapeHtml, escapeScript, flatMap, getId, htmlClose, htmlOpen, loadCSS, loadJS, memoize, noop, persistCSS, persistJS, walkTree, wrapFunction, wrapHtml, wrapStyle };
