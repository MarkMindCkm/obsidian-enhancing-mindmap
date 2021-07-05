/*! markmap-lib v0.11.6 | MIT License */
import _extends from '@babel/runtime/helpers/esm/extends';
import { persistCSS, persistJS, wrapFunction, Hook } from 'markmap-common';
import { Remarkable } from 'remarkable';
import remarkableKatex from 'remarkable-katex';
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/';

const template = "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<meta http-equiv=\"X-UA-Compatible\" content=\"ie=edge\">\n<title>Markmap</title>\n<style>\n* {\n  margin: 0;\n  padding: 0;\n}\n#mindmap {\n  display: block;\n  width: 100vw;\n  height: 100vh;\n}\n</style>\n<!--CSS-->\n</head>\n<body>\n<svg id=\"mindmap\"></svg>\n<!--JS-->\n</body>\n</html>\n";
const BASE_JS = [`https://cdn.jsdelivr.net/npm/d3@${"6.6.0"}`, `https://cdn.jsdelivr.net/npm/markmap-view@${"0.2.6"}`].map(src => ({
  type: 'script',
  data: {
    src
  }
}));
function fillTemplate(data, assets, extra) {
  if (typeof extra === 'function') {
    extra = {
      getOptions: extra
    };
  }

  extra = _extends({
    baseJs: BASE_JS
  }, extra);
  const {
    scripts,
    styles
  } = assets;
  const cssList = [...(styles ? persistCSS(styles) : [])];
  const context = {
    getMarkmap: () => window.markmap,
    getOptions: extra.getOptions,
    data
  };
  const jsList = [...persistJS(extra.baseJs), ...persistJS([...(scripts || []), {
    type: 'iife',
    data: {
      fn: (getMarkmap, getOptions, data) => {
        const {
          Markmap
        } = getMarkmap();
        window.mm = Markmap.create('svg#mindmap', getOptions == null ? void 0 : getOptions(), data);
      },
      getParams: ({
        getMarkmap,
        getOptions,
        data
      }) => {
        return [getMarkmap, getOptions, data];
      }
    }
  }], context)];
  const html = template.replace('<!--CSS-->', () => cssList.join('')).replace('<!--JS-->', () => jsList.join(''));
  return html;
}

const name$1 = 'katex';
function transform$1(transformHooks) {
  transformHooks.parser.tap((md, features) => {
    md.use(remarkableKatex);
    md.renderer.rules.katex = wrapFunction(md.renderer.rules.katex, {
      after: () => {
        features[name$1] = true;
      }
    });
  });
  return {
    styles: [{
      type: 'stylesheet',
      data: {
        href: 'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css'
      }
    }],
    scripts: [{
      type: 'iife',
      data: {
        fn: getMarkmap => {
          window.WebFontConfig = {
            custom: {
              families: ['KaTeX_AMS', 'KaTeX_Caligraphic:n4,n7', 'KaTeX_Fraktur:n4,n7', 'KaTeX_Main:n4,n7,i4,i7', 'KaTeX_Math:i4,i7', 'KaTeX_Script', 'KaTeX_SansSerif:n4,n7,i4', 'KaTeX_Size1', 'KaTeX_Size2', 'KaTeX_Size3', 'KaTeX_Size4', 'KaTeX_Typewriter']
            },
            active: () => {
              getMarkmap().refreshHook.call();
            }
          };
        },

        getParams({
          getMarkmap
        }) {
          return [getMarkmap];
        }

      }
    }, {
      type: 'script',
      data: {
        src: 'https://cdn.jsdelivr.net/npm/webfontloader@1.6.28/webfontloader.js',
        defer: true
      }
    }]
  };
}

var katex = /*#__PURE__*/Object.freeze({
__proto__: null,
name: name$1,
transform: transform$1
});

const name = 'prism';
function transform(transformHooks) {
  transformHooks.parser.tap((md, features) => {
    md.set({
      highlight: (str, lang) => {
        features[name] = true;
        let grammar = Prism.languages[lang];

        if (!grammar) {
          loadLanguages([lang]);
          grammar = Prism.languages[lang];
        }

        if (grammar) {
          return Prism.highlight(str, grammar, lang);
        }

        return '';
      }
    });
  });
  return {
    styles: [{
      type: 'stylesheet',
      data: {
        href: `https://cdn.jsdelivr.net/npm/prismjs@${"1.23.0"}/themes/prism.css`
      }
    }]
  };
}

var prism = /*#__PURE__*/Object.freeze({
__proto__: null,
name: name,
transform: transform
});

function createTransformHooks() {
  return {
    parser: new Hook(),
    htmltag: new Hook(),

    /**
     * Indicate that the last transformation is not complete for reasons like
     * lack of resources and is called when it is ready for a new transformation.
     */
    retransform: new Hook()
  };
}

const plugins = [katex, prism];

function cleanNode(node, depth = 0) {
  if (node.t === 'heading') {
    // drop all paragraphs
    node.c = node.c.filter(item => item.t !== 'paragraph');
  } else if (node.t === 'list_item') {
    var _node$p;

    // keep first paragraph as content of list_item, drop others
    node.c = node.c.filter(item => {
      if (['paragraph', 'fence'].includes(item.t)) {
        if (!node.v) {
          node.v = item.v;
          node.p = _extends({}, node.p, item.p);
        }

        return false;
      }

      return true;
    });

    if (((_node$p = node.p) == null ? void 0 : _node$p.index) != null) {
      node.v = `${node.p.index}. ${node.v}`;
    }
  } else if (node.t === 'ordered_list') {
    var _node$p$start, _node$p2;

    let index = (_node$p$start = (_node$p2 = node.p) == null ? void 0 : _node$p2.start) != null ? _node$p$start : 1;
    node.c.forEach(item => {
      if (item.t === 'list_item') {
        item.p = _extends({}, item.p, {
          index
        });
        index += 1;
      }
    });
  }

  if (node.c.length === 0) {
    delete node.c;
  } else {
    node.c.forEach(child => cleanNode(child, depth + 1));

    if (node.c.length === 1 && !node.c[0].v) {
      node.c = node.c[0].c;
    }
  }

  node.d = depth;
}

class Transformer {
  constructor(plugins$1 = plugins) {
    this.plugins = void 0;
    this.hooks = void 0;
    this.md = void 0;
    this.assetsMap = void 0;
    this.plugins = plugins$1;
    this.hooks = createTransformHooks();
    const md = new Remarkable({
      html: true,
      breaks: true,
      maxNesting: Infinity
    });
    md.block.ruler.enable(['deflist']);
    md.renderer.rules.htmltag = wrapFunction(md.renderer.rules.htmltag, {
      after: ctx => {
        this.hooks.htmltag.call(ctx);
      }
    });
    this.md = md;
    const assetsMap = {};

    for (const {
      name,
      transform
    } of plugins$1) {
      assetsMap[name] = transform(this.hooks);
    }

    this.assetsMap = assetsMap;
  }

  buildTree(tokens) {
    const {
      md
    } = this; // TODO deal with <dl><dt>

    const root = {
      t: 'root',
      d: 0,
      v: '',
      c: [],
      p: {}
    };
    const stack = [root];
    let depth = 0;

    for (const token of tokens) {
      let current = stack[stack.length - 1];

      if (token.type.endsWith('_open')) {
        const type = token.type.slice(0, -5);
        const payload = {};

        if (token.lines) {
          payload.lines = token.lines;
        }

        if (type === 'heading') {
          depth = token.hLevel;

          while (((_current = current) == null ? void 0 : _current.d) >= depth) {
            var _current;

            stack.pop();
            current = stack[stack.length - 1];
          }
        } else {
          var _current2;

          depth = Math.max(depth, ((_current2 = current) == null ? void 0 : _current2.d) || 0) + 1;

          if (type === 'ordered_list') {
            payload.start = token.order;
          }
        }

        const item = {
          t: type,
          d: depth,
          p: payload,
          v: '',
          c: []
        };
        current.c.push(item);
        stack.push(item);
      } else if (!current) {
        continue;
      } else if (token.type === `${current.t}_close`) {
        if (current.t === 'heading') {
          depth = current.d;
        } else {
          stack.pop();
          depth = 0;
        }
      } else if (token.type === 'inline') {
        const revoke = this.hooks.htmltag.tap(ctx => {
          const comment = ctx.result.match(/^<!--([\s\S]*?)-->$/);
          const data = comment == null ? void 0 : comment[1].trim();

          if (data === 'fold') {
            current.p.f = true;
            ctx.result = '';
          }
        });
        const text = md.renderer.render([token], md.options, {});
        revoke();
        current.v = `${current.v || ''}${text}`;
      } else if (token.type === 'fence') {
        let result = md.renderer.render([token], md.options, {}); // Remarkable only adds className to `<code>` but not `<pre>`, copy it to make PrismJS style work.

        const matches = result.match(/<code( class="[^"]*")>/);
        if (matches) result = result.replace('<pre>', `<pre${matches[1]}>`);
        current.c.push({
          t: token.type,
          d: depth + 1,
          v: result,
          c: []
        });
      } else ;
    }

    return root;
  }

  transform(content) {
    var _root$c;

    const features = {};
    this.hooks.parser.call(this.md, features);
    const tokens = this.md.parse(content || '', {});
    let root = this.buildTree(tokens);
    cleanNode(root);
    if (((_root$c = root.c) == null ? void 0 : _root$c.length) === 1) root = root.c[0];
    return {
      root,
      features
    };
  }
  /**
   * Get all assets from enabled plugins or filter them by plugin names as keys.
   */


  getAssets(keys) {
    var _keys;

    const styles = [];
    const scripts = [];
    (_keys = keys) != null ? _keys : keys = Object.keys(this.assetsMap);

    for (const assets of keys.map(key => this.assetsMap[key])) {
      if (assets) {
        if (assets.styles) styles.push(...assets.styles);
        if (assets.scripts) scripts.push(...assets.scripts);
      }
    }

    return {
      styles,
      scripts
    };
  }
  /**
   * Get used assets by features object returned by `transform`.
   */


  getUsedAssets(features) {
    return this.getAssets(Object.keys(features).filter(key => features[key]));
  }

}

export { Transformer, plugins as builtInPlugins, fillTemplate };
