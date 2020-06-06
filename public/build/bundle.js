var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    /**
     * Expose `pathtoRegexp`.
     */

    var pathToRegexp = pathtoRegexp;

    /**
     * Match matching groups in a regular expression.
     */
    var MATCHING_GROUP_REGEXP = /\((?!\?)/g;

    /**
     * Normalize the given path string,
     * returning a regular expression.
     *
     * An empty array should be passed,
     * which will contain the placeholder
     * key names. For example "/user/:id" will
     * then contain ["id"].
     *
     * @param  {String|RegExp|Array} path
     * @param  {Array} keys
     * @param  {Object} options
     * @return {RegExp}
     * @api private
     */

    function pathtoRegexp(path, keys, options) {
      options = options || {};
      keys = keys || [];
      var strict = options.strict;
      var end = options.end !== false;
      var flags = options.sensitive ? '' : 'i';
      var extraOffset = 0;
      var keysOffset = keys.length;
      var i = 0;
      var name = 0;
      var m;

      if (path instanceof RegExp) {
        while (m = MATCHING_GROUP_REGEXP.exec(path.source)) {
          keys.push({
            name: name++,
            optional: false,
            offset: m.index
          });
        }

        return path;
      }

      if (Array.isArray(path)) {
        // Map array parts into regexps and return their source. We also pass
        // the same keys and options instance into every generation to get
        // consistent matching groups before we join the sources together.
        path = path.map(function (value) {
          return pathtoRegexp(value, keys, options).source;
        });

        return new RegExp('(?:' + path.join('|') + ')', flags);
      }

      path = ('^' + path + (strict ? '' : path[path.length - 1] === '/' ? '?' : '/?'))
        .replace(/\/\(/g, '/(?:')
        .replace(/([\/\.])/g, '\\$1')
        .replace(/(\\\/)?(\\\.)?:(\w+)(\(.*?\))?(\*)?(\?)?/g, function (match, slash, format, key, capture, star, optional, offset) {
          slash = slash || '';
          format = format || '';
          capture = capture || '([^\\/' + format + ']+?)';
          optional = optional || '';

          keys.push({
            name: key,
            optional: !!optional,
            offset: offset + extraOffset
          });

          var result = ''
            + (optional ? '' : slash)
            + '(?:'
            + format + (optional ? slash : '') + capture
            + (star ? '((?:[\\/' + format + '].+?)?)' : '')
            + ')'
            + optional;

          extraOffset += result.length - match.length;

          return result;
        })
        .replace(/\*/g, function (star, index) {
          var len = keys.length;

          while (len-- > keysOffset && keys[len].offset > index) {
            keys[len].offset += 3; // Replacement length minus asterisk length.
          }

          return '(.*)';
        });

      // This is a workaround for handling unnamed matching groups.
      while (m = MATCHING_GROUP_REGEXP.exec(path)) {
        var escapeCount = 0;
        var index = m.index;

        while (path.charAt(--index) === '\\') {
          escapeCount++;
        }

        // It's possible to escape the bracket.
        if (escapeCount % 2 === 1) {
          continue;
        }

        if (keysOffset + i === keys.length || keys[keysOffset + i].offset > m.index) {
          keys.splice(keysOffset + i, 0, {
            name: name++, // Unnamed matching groups must be consistently linear.
            optional: false,
            offset: m.index
          });
        }

        i++;
      }

      // If the path is non-ending, match until the end or a slash.
      path += (end ? '$' : (path[path.length - 1] === '/' ? '' : '(?=\\/|$)'));

      return new RegExp(path, flags);
    }

    /**
       * Module dependencies.
       */

      

      /**
       * Module exports.
       */

      var page_js = page;

      /**
       * Detect click event
       */
      var clickEvent = ('undefined' !== typeof document) && document.ontouchstart ? 'touchstart' : 'click';

      /**
       * To work properly with the URL
       * history.location generated polyfill in https://github.com/devote/HTML5-History-API
       */

      var location = ('undefined' !== typeof window) && (window.history.location || window.location);

      /**
       * Perform initial dispatch.
       */

      var dispatch$1 = true;


      /**
       * Decode URL components (query string, pathname, hash).
       * Accommodates both regular percent encoding and x-www-form-urlencoded format.
       */
      var decodeURLComponents = true;

      /**
       * Base path.
       */

      var base = '';

      /**
       * Running flag.
       */

      var running;

      /**
       * HashBang option
       */

      var hashbang = false;

      /**
       * Previous context, for capturing
       * page exit events.
       */

      var prevContext;

      /**
       * Register `path` with callback `fn()`,
       * or route `path`, or redirection,
       * or `page.start()`.
       *
       *   page(fn);
       *   page('*', fn);
       *   page('/user/:id', load, user);
       *   page('/user/' + user.id, { some: 'thing' });
       *   page('/user/' + user.id);
       *   page('/from', '/to')
       *   page();
       *
       * @param {String|Function} path
       * @param {Function} fn...
       * @api public
       */

      function page(path, fn) {
        // <callback>
        if ('function' === typeof path) {
          return page('*', path);
        }

        // route <path> to <callback ...>
        if ('function' === typeof fn) {
          var route = new Route(path);
          for (var i = 1; i < arguments.length; ++i) {
            page.callbacks.push(route.middleware(arguments[i]));
          }
          // show <path> with [state]
        } else if ('string' === typeof path) {
          page['string' === typeof fn ? 'redirect' : 'show'](path, fn);
          // start [options]
        } else {
          page.start(path);
        }
      }

      /**
       * Callback functions.
       */

      page.callbacks = [];
      page.exits = [];

      /**
       * Current path being processed
       * @type {String}
       */
      page.current = '';

      /**
       * Number of pages navigated to.
       * @type {number}
       *
       *     page.len == 0;
       *     page('/login');
       *     page.len == 1;
       */

      page.len = 0;

      /**
       * Get or set basepath to `path`.
       *
       * @param {String} path
       * @api public
       */

      page.base = function(path) {
        if (0 === arguments.length) return base;
        base = path;
      };

      /**
       * Bind with the given `options`.
       *
       * Options:
       *
       *    - `click` bind to click events [true]
       *    - `popstate` bind to popstate [true]
       *    - `dispatch` perform initial dispatch [true]
       *
       * @param {Object} options
       * @api public
       */

      page.start = function(options) {
        options = options || {};
        if (running) return;
        running = true;
        if (false === options.dispatch) dispatch$1 = false;
        if (false === options.decodeURLComponents) decodeURLComponents = false;
        if (false !== options.popstate) window.addEventListener('popstate', onpopstate, false);
        if (false !== options.click) {
          document.addEventListener(clickEvent, onclick, false);
        }
        if (true === options.hashbang) hashbang = true;
        if (!dispatch$1) return;
        var url = (hashbang && ~location.hash.indexOf('#!')) ? location.hash.substr(2) + location.search : location.pathname + location.search + location.hash;
        page.replace(url, null, true, dispatch$1);
      };

      /**
       * Unbind click and popstate event handlers.
       *
       * @api public
       */

      page.stop = function() {
        if (!running) return;
        page.current = '';
        page.len = 0;
        running = false;
        document.removeEventListener(clickEvent, onclick, false);
        window.removeEventListener('popstate', onpopstate, false);
      };

      /**
       * Show `path` with optional `state` object.
       *
       * @param {String} path
       * @param {Object} state
       * @param {Boolean} dispatch
       * @return {Context}
       * @api public
       */

      page.show = function(path, state, dispatch, push) {
        var ctx = new Context(path, state);
        page.current = ctx.path;
        if (false !== dispatch) page.dispatch(ctx);
        if (false !== ctx.handled && false !== push) ctx.pushState();
        return ctx;
      };

      /**
       * Goes back in the history
       * Back should always let the current route push state and then go back.
       *
       * @param {String} path - fallback path to go back if no more history exists, if undefined defaults to page.base
       * @param {Object} [state]
       * @api public
       */

      page.back = function(path, state) {
        if (page.len > 0) {
          // this may need more testing to see if all browsers
          // wait for the next tick to go back in history
          history.back();
          page.len--;
        } else if (path) {
          setTimeout(function() {
            page.show(path, state);
          });
        }else {
          setTimeout(function() {
            page.show(base, state);
          });
        }
      };


      /**
       * Register route to redirect from one path to other
       * or just redirect to another route
       *
       * @param {String} from - if param 'to' is undefined redirects to 'from'
       * @param {String} [to]
       * @api public
       */
      page.redirect = function(from, to) {
        // Define route from a path to another
        if ('string' === typeof from && 'string' === typeof to) {
          page(from, function(e) {
            setTimeout(function() {
              page.replace(to);
            }, 0);
          });
        }

        // Wait for the push state and replace it with another
        if ('string' === typeof from && 'undefined' === typeof to) {
          setTimeout(function() {
            page.replace(from);
          }, 0);
        }
      };

      /**
       * Replace `path` with optional `state` object.
       *
       * @param {String} path
       * @param {Object} state
       * @return {Context}
       * @api public
       */


      page.replace = function(path, state, init, dispatch) {
        var ctx = new Context(path, state);
        page.current = ctx.path;
        ctx.init = init;
        ctx.save(); // save before dispatching, which may redirect
        if (false !== dispatch) page.dispatch(ctx);
        return ctx;
      };

      /**
       * Dispatch the given `ctx`.
       *
       * @param {Object} ctx
       * @api private
       */

      page.dispatch = function(ctx) {
        var prev = prevContext,
          i = 0,
          j = 0;

        prevContext = ctx;

        function nextExit() {
          var fn = page.exits[j++];
          if (!fn) return nextEnter();
          fn(prev, nextExit);
        }

        function nextEnter() {
          var fn = page.callbacks[i++];

          if (ctx.path !== page.current) {
            ctx.handled = false;
            return;
          }
          if (!fn) return unhandled(ctx);
          fn(ctx, nextEnter);
        }

        if (prev) {
          nextExit();
        } else {
          nextEnter();
        }
      };

      /**
       * Unhandled `ctx`. When it's not the initial
       * popstate then redirect. If you wish to handle
       * 404s on your own use `page('*', callback)`.
       *
       * @param {Context} ctx
       * @api private
       */

      function unhandled(ctx) {
        if (ctx.handled) return;
        var current;

        if (hashbang) {
          current = base + location.hash.replace('#!', '');
        } else {
          current = location.pathname + location.search;
        }

        if (current === ctx.canonicalPath) return;
        page.stop();
        ctx.handled = false;
        location.href = ctx.canonicalPath;
      }

      /**
       * Register an exit route on `path` with
       * callback `fn()`, which will be called
       * on the previous context when a new
       * page is visited.
       */
      page.exit = function(path, fn) {
        if (typeof path === 'function') {
          return page.exit('*', path);
        }

        var route = new Route(path);
        for (var i = 1; i < arguments.length; ++i) {
          page.exits.push(route.middleware(arguments[i]));
        }
      };

      /**
       * Remove URL encoding from the given `str`.
       * Accommodates whitespace in both x-www-form-urlencoded
       * and regular percent-encoded form.
       *
       * @param {str} URL component to decode
       */
      function decodeURLEncodedURIComponent(val) {
        if (typeof val !== 'string') { return val; }
        return decodeURLComponents ? decodeURIComponent(val.replace(/\+/g, ' ')) : val;
      }

      /**
       * Initialize a new "request" `Context`
       * with the given `path` and optional initial `state`.
       *
       * @param {String} path
       * @param {Object} state
       * @api public
       */

      function Context(path, state) {
        if ('/' === path[0] && 0 !== path.indexOf(base)) path = base + (hashbang ? '#!' : '') + path;
        var i = path.indexOf('?');

        this.canonicalPath = path;
        this.path = path.replace(base, '') || '/';
        if (hashbang) this.path = this.path.replace('#!', '') || '/';

        this.title = document.title;
        this.state = state || {};
        this.state.path = path;
        this.querystring = ~i ? decodeURLEncodedURIComponent(path.slice(i + 1)) : '';
        this.pathname = decodeURLEncodedURIComponent(~i ? path.slice(0, i) : path);
        this.params = {};

        // fragment
        this.hash = '';
        if (!hashbang) {
          if (!~this.path.indexOf('#')) return;
          var parts = this.path.split('#');
          this.path = parts[0];
          this.hash = decodeURLEncodedURIComponent(parts[1]) || '';
          this.querystring = this.querystring.split('#')[0];
        }
      }

      /**
       * Expose `Context`.
       */

      page.Context = Context;

      /**
       * Push state.
       *
       * @api private
       */

      Context.prototype.pushState = function() {
        page.len++;
        history.pushState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
      };

      /**
       * Save the context state.
       *
       * @api public
       */

      Context.prototype.save = function() {
        history.replaceState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
      };

      /**
       * Initialize `Route` with the given HTTP `path`,
       * and an array of `callbacks` and `options`.
       *
       * Options:
       *
       *   - `sensitive`    enable case-sensitive routes
       *   - `strict`       enable strict matching for trailing slashes
       *
       * @param {String} path
       * @param {Object} options.
       * @api private
       */

      function Route(path, options) {
        options = options || {};
        this.path = path;
        this.method = 'GET';
        this.regexp = pathToRegexp(this.path,
          this.keys = [],
          options.sensitive,
          options.strict);
      }

      /**
       * Expose `Route`.
       */

      page.Route = Route;

      /**
       * Return route middleware with
       * the given callback `fn()`.
       *
       * @param {Function} fn
       * @return {Function}
       * @api public
       */

      Route.prototype.middleware = function(fn) {
        var self = this;
        return function(ctx, next) {
          if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
          next();
        };
      };

      /**
       * Check if this route matches `path`, if so
       * populate `params`.
       *
       * @param {String} path
       * @param {Object} params
       * @return {Boolean}
       * @api private
       */

      Route.prototype.match = function(path, params) {
        var keys = this.keys,
          qsIndex = path.indexOf('?'),
          pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
          m = this.regexp.exec(decodeURIComponent(pathname));

        if (!m) return false;

        for (var i = 1, len = m.length; i < len; ++i) {
          var key = keys[i - 1];
          if (key) {
            var val = decodeURLEncodedURIComponent(m[i]);
            if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
              params[key.name] = val;
            }        
          }

        }

        return true;
      };


      /**
       * Handle "populate" events.
       */

      var onpopstate = (function () {
        var loaded = false;
        if ('undefined' === typeof window) {
          return;
        }
        if (document.readyState === 'complete') {
          loaded = true;
        } else {
          window.addEventListener('load', function() {
            setTimeout(function() {
              loaded = true;
            }, 0);
          });
        }
        return function onpopstate(e) {
          if (!loaded) return;
          if (e.state) {
            var path = e.state.path;
            page.replace(path, e.state);
          } else {
            page.show(location.pathname + location.hash, undefined, undefined, false);
          }
        };
      })();
      /**
       * Handle "click" events.
       */

      function onclick(e) {

        if (1 !== which(e)) return;

        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        if (e.defaultPrevented) return;



        // ensure link
        var el = e.target;
        while (el && 'A' !== el.nodeName) el = el.parentNode;
        if (!el || 'A' !== el.nodeName) return;



        // Ignore if tag has
        // 1. "download" attribute
        // 2. rel="external" attribute
        if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;

        // ensure non-hash for the same path
        var link = el.getAttribute('href');
        if (!hashbang && el.pathname === location.pathname && (el.hash || '#' === link)) return;



        // Check for mailto: in the href
        if (link && link.indexOf('mailto:') > -1) return;

        // check target
        if (el.target) return;

        // x-origin
        if (!sameOrigin(el.href)) return;



        // rebuild path
        var path = el.pathname + el.search + (el.hash || '');

        // strip leading "/[drive letter]:" on NW.js on Windows
        if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
          path = path.replace(/^\/[a-zA-Z]:\//, '/');
        }

        // same page
        var orig = path;

        if (path.indexOf(base) === 0) {
          path = path.substr(base.length);
        }

        if (hashbang) path = path.replace('#!', '');

        if (base && orig === path) return;

        e.preventDefault();
        page.show(orig);
      }

      /**
       * Event button.
       */

      function which(e) {
        e = e || window.event;
        return null === e.which ? e.button : e.which;
      }

      /**
       * Check if `href` is the same origin.
       */

      function sameOrigin(href) {
        var origin = location.protocol + '//' + location.hostname;
        if (location.port) origin += ':' + location.port;
        return (href && (0 === href.indexOf(origin)));
      }

      page.sameOrigin = sameOrigin;

    /* src/UI/Header.svelte generated by Svelte v3.23.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (131:8) {#each routeLinks as link}
    function create_each_block(ctx) {
    	let a;
    	let t0_value = /*link*/ ctx[7].name + "";
    	let t0;
    	let t1;
    	let a_href_value;

    	return {
    		c() {
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			set_style(a, "margin-left", "20px");
    			attr(a, "href", a_href_value = /*link*/ ctx[7].path);
    			attr(a, "class", "svelte-iewmzd");
    			toggle_class(a, "active", /*currentPage*/ ctx[0] === /*link*/ ctx[7].path);
    		},
    		m(target, anchor) {
    			insert(target, a, anchor);
    			append(a, t0);
    			append(a, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*currentPage, routeLinks*/ 3) {
    				toggle_class(a, "active", /*currentPage*/ ctx[0] === /*link*/ ctx[7].path);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(a);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div6;
    	let div5;
    	let div0;
    	let t1;
    	let nav;
    	let ul;
    	let t2;
    	let div4;
    	let mounted;
    	let dispose;
    	let each_value = /*routeLinks*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div6 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.innerHTML = `<span><h3>simmedia</h3></span>`;
    			t1 = space();
    			nav = element("nav");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			div4 = element("div");

    			div4.innerHTML = `<div class="svelte-iewmzd"></div> 
      <div class="svelte-iewmzd"></div> 
      <div class="svelte-iewmzd"></div>`;

    			attr(div0, "class", "logo");
    			attr(ul, "class", "svelte-iewmzd");
    			attr(nav, "class", "svelte-iewmzd");
    			attr(div4, "class", "burger svelte-iewmzd");
    			attr(div5, "class", "h-container svelte-iewmzd");
    			attr(div6, "class", "header svelte-iewmzd");
    		},
    		m(target, anchor) {
    			insert(target, div6, anchor);
    			append(div6, div5);
    			append(div5, div0);
    			append(div5, t1);
    			append(div5, nav);
    			append(nav, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append(div5, t2);
    			append(div5, div4);

    			if (!mounted) {
    				dispose = listen(div4, "click", /*click_handler*/ ctx[6]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*routeLinks, currentPage*/ 3) {
    				each_value = /*routeLinks*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div6);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let navLinks = ["Home", "About", "Handwashing", "Notes", "Contact"];

    	let routeLinks = [
    		{ name: "Home", path: "/" },
    		{ name: "About", path: "/about" },
    		{
    			name: "Handwashing",
    			path: "/handwashing"
    		},
    		{ name: "Notes", path: "/notes" },
    		{ name: "Contact", path: "/contact" }
    	];

    	let { currentPage } = $$props;
    	const dispatch = createEventDispatcher();

    	function navigate(ctx, next) {
    		console.log(`navigate to: ${ctx.path}`);
    		dispatch("changePage", ctx.path);
    	}

    	page_js("/", navigate);
    	page_js("/about", navigate);
    	page_js("/notes", navigate);
    	page_js("/handwashing", navigate);
    	page_js("/contact", navigate);
    	page_js.start();

    	const changePage = e => {
    		dispatch("changePage", e);
    	};

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$set = $$props => {
    		if ("currentPage" in $$props) $$invalidate(0, currentPage = $$props.currentPage);
    	};

    	return [
    		currentPage,
    		routeLinks,
    		navLinks,
    		dispatch,
    		navigate,
    		changePage,
    		click_handler
    	];
    }

    class Header extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { currentPage: 0 });
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/UI/Sidenav.svelte generated by Svelte v3.23.0 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (58:0) {#if show}
    function create_if_block(ctx) {
    	let div;
    	let span;
    	let t1;
    	let nav;
    	let ul;
    	let div_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*navLinks*/ ctx[2];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div = element("div");
    			span = element("span");
    			span.textContent = "+";
    			t1 = space();
    			nav = element("nav");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(span, "class", "close svelte-1kn2sj3");
    			attr(ul, "class", "svelte-1kn2sj3");
    			attr(nav, "class", "svelte-1kn2sj3");
    			attr(div, "class", "sidenav svelte-1kn2sj3");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span);
    			append(div, t1);
    			append(div, nav);
    			append(nav, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(span, "click", /*click_handler*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*currentPage, navLinks, changePage*/ 21) {
    				each_value = /*navLinks*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fly, { x: -500, opacity: 1 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fly, { x: -500, opacity: 1 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			if (detaching && div_transition) div_transition.end();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (63:8) {#each navLinks as link}
    function create_each_block$1(ctx) {
    	let li;
    	let t0_value = /*link*/ ctx[7] + "";
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[6](/*link*/ ctx[7], ...args);
    	}

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    			attr(li, "class", "svelte-1kn2sj3");
    			toggle_class(li, "active", /*currentPage*/ ctx[0] === /*link*/ ctx[7]);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);

    			if (!mounted) {
    				dispose = listen(li, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*currentPage, navLinks*/ 5) {
    				toggle_class(li, "active", /*currentPage*/ ctx[0] === /*link*/ ctx[7]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*show*/ ctx[1] && create_if_block(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*show*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*show*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let navLinks = ["Home", "About", "Handwashing", "Notes", "Contact"];
    	let { currentPage } = $$props;
    	let { show = false } = $$props;
    	const dispatch = createEventDispatcher();

    	const changePage = e => {
    		dispatch("changePage", e);
    	};

    	const click_handler = () => dispatch("closeNav");
    	const click_handler_1 = link => changePage(link);

    	$$self.$set = $$props => {
    		if ("currentPage" in $$props) $$invalidate(0, currentPage = $$props.currentPage);
    		if ("show" in $$props) $$invalidate(1, show = $$props.show);
    	};

    	return [
    		currentPage,
    		show,
    		navLinks,
    		dispatch,
    		changePage,
    		click_handler,
    		click_handler_1
    	];
    }

    class Sidenav extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { currentPage: 0, show: 1 });
    	}
    }

    /* src/components/Jumbotron.svelte generated by Svelte v3.23.0 */

    function create_fragment$2(ctx) {
    	let div2;

    	return {
    		c() {
    			div2 = element("div");

    			div2.innerHTML = `<div class="jumbotron svelte-1l3z143"><h1 class="svelte-1l3z143">Hello there people!</h1> 
    <p class="svelte-1l3z143">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Quam saepe
      adipisci rerum consequatur enim tempora ipsa dolor eum vero illo?
    </p></div> 

  <div class="image svelte-1l3z143"><img width="100%" src="./images/home-image.jpg" alt="" class="svelte-1l3z143"></div>`;

    			attr(div2, "class", "container svelte-1l3z143");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    		}
    	};
    }

    class Jumbotron extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src/pages/Home.svelte generated by Svelte v3.23.0 */

    function create_fragment$3(ctx) {
    	let current;
    	const jumbotron = new Jumbotron({});

    	return {
    		c() {
    			create_component(jumbotron.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(jumbotron, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(jumbotron.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(jumbotron.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(jumbotron, detaching);
    		}
    	};
    }

    class Home extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/UI/Button.svelte generated by Svelte v3.23.0 */

    function create_fragment$4(ctx) {
    	let button;
    	let button_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	return {
    		c() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			button.disabled = /*disabled*/ ctx[1];
    			attr(button, "class", button_class_value = "" + (null_to_empty(/*color*/ ctx[0]) + " svelte-dputsf"));
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 4) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[2], dirty, null, null);
    				}
    			}

    			if (!current || dirty & /*disabled*/ 2) {
    				button.disabled = /*disabled*/ ctx[1];
    			}

    			if (!current || dirty & /*color*/ 1 && button_class_value !== (button_class_value = "" + (null_to_empty(/*color*/ ctx[0]) + " svelte-dputsf"))) {
    				attr(button, "class", button_class_value);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { color = "" } = $$props;
    	let { disabled = false } = $$props;
    	let { $$slots = {}, $$scope } = $$props;

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$set = $$props => {
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    		if ("disabled" in $$props) $$invalidate(1, disabled = $$props.disabled);
    		if ("$$scope" in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	return [color, disabled, $$scope, $$slots, click_handler];
    }

    class Button extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$4, safe_not_equal, { color: 0, disabled: 1 });
    	}
    }

    /* src/pages/About.svelte generated by Svelte v3.23.0 */

    function create_default_slot(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Klikni");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let div0;
    	let t1;
    	let t2;
    	let div2;
    	let current;

    	const button = new Button({
    			props: {
    				color: "blue",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	button.$on("click", /*handleClick*/ ctx[0]);

    	return {
    		c() {
    			div0 = element("div");
    			div0.innerHTML = `<h1>About page</h1>`;
    			t1 = space();
    			create_component(button.$$.fragment);
    			t2 = space();
    			div2 = element("div");
    			div2.innerHTML = `<div class="col"></div>`;
    			attr(div2, "class", "row");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t1, anchor);
    			mount_component(button, target, anchor);
    			insert(target, t2, anchor);
    			insert(target, div2, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			destroy_component(button, detaching);
    			if (detaching) detach(t2);
    			if (detaching) detach(div2);
    		}
    	};
    }

    function instance$3($$self) {
    	const dispatch = createEventDispatcher();

    	const handleClick = () => {
    		console.log("handleClick clicked!");

    		dispatch("action", {
    			name: "Stefan",
    			age: 28,
    			position: "Front End Developer"
    		});
    	};

    	return [handleClick];
    }

    class About extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$5, safe_not_equal, {});
    	}
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function is_date(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    function get_interpolator(a, b) {
        if (a === b || a !== a)
            return () => a;
        const type = typeof a;
        if (type !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
            throw new Error('Cannot interpolate values of different type');
        }
        if (Array.isArray(a)) {
            const arr = b.map((bi, i) => {
                return get_interpolator(a[i], bi);
            });
            return t => arr.map(fn => fn(t));
        }
        if (type === 'object') {
            if (!a || !b)
                throw new Error('Object cannot be null');
            if (is_date(a) && is_date(b)) {
                a = a.getTime();
                b = b.getTime();
                const delta = b - a;
                return t => new Date(a + t * delta);
            }
            const keys = Object.keys(b);
            const interpolators = {};
            keys.forEach(key => {
                interpolators[key] = get_interpolator(a[key], b[key]);
            });
            return t => {
                const result = {};
                keys.forEach(key => {
                    result[key] = interpolators[key](t);
                });
                return result;
            };
        }
        if (type === 'number') {
            const delta = b - a;
            return t => a + t * delta;
        }
        throw new Error(`Cannot interpolate ${type} values`);
    }
    function tweened(value, defaults = {}) {
        const store = writable(value);
        let task;
        let target_value = value;
        function set(new_value, opts) {
            if (value == null) {
                store.set(value = new_value);
                return Promise.resolve();
            }
            target_value = new_value;
            let previous_task = task;
            let started = false;
            let { delay = 0, duration = 400, easing = identity, interpolate = get_interpolator } = assign(assign({}, defaults), opts);
            if (duration === 0) {
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                store.set(value = target_value);
                return Promise.resolve();
            }
            const start = now() + delay;
            let fn;
            task = loop(now => {
                if (now < start)
                    return true;
                if (!started) {
                    fn = interpolate(value, new_value);
                    if (typeof duration === 'function')
                        duration = duration(value, new_value);
                    started = true;
                }
                if (previous_task) {
                    previous_task.abort();
                    previous_task = null;
                }
                const elapsed = now - start;
                if (elapsed > duration) {
                    store.set(value = new_value);
                    return false;
                }
                // @ts-ignore
                store.set(value = fn(easing(elapsed / duration)));
                return true;
            });
            return task.promise;
        }
        return {
            set,
            update: (fn, opts) => set(fn(target_value, value), opts),
            subscribe: store.subscribe
        };
    }

    /* src/components/HowTo/ProgressBar.svelte generated by Svelte v3.23.0 */

    function create_fragment$6(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let span;
    	let t0;
    	let t1;

    	return {
    		c() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			t0 = text(/*progress*/ ctx[0]);
    			t1 = text("%");
    			attr(span, "class", "sr-only svelte-w4kg78");
    			set_style(div0, "width", /*$tweenedProgress*/ ctx[1] + "%");
    			attr(div0, "class", "progress-bar svelte-w4kg78");
    			attr(div1, "bp", "offset-5@md 4@md 12@sm");
    			attr(div1, "class", "progress-container svelte-w4kg78");
    			attr(div2, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div1);
    			append(div1, div0);
    			append(div0, span);
    			append(span, t0);
    			append(span, t1);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*progress*/ 1) set_data(t0, /*progress*/ ctx[0]);

    			if (dirty & /*$tweenedProgress*/ 2) {
    				set_style(div0, "width", /*$tweenedProgress*/ ctx[1] + "%");
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div2);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $tweenedProgress;
    	let { progress = 0 } = $$props;
    	const tweenedProgress = tweened(0);
    	component_subscribe($$self, tweenedProgress, value => $$invalidate(1, $tweenedProgress = value));

    	$$self.$set = $$props => {
    		if ("progress" in $$props) $$invalidate(0, progress = $$props.progress);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*progress*/ 1) {
    			 tweenedProgress.set(progress);
    		}
    	};

    	return [progress, $tweenedProgress, tweenedProgress];
    }

    class ProgressBar extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$6, safe_not_equal, { progress: 0 });
    	}
    }

    /* src/components/HowTo/Timer.svelte generated by Svelte v3.23.0 */

    function create_default_slot_1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Start");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (49:0) <Button disabled={!isRunning} on:click={() => (stoped = true)}>
    function create_default_slot$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Restart");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function create_fragment$7(ctx) {
    	let div2;
    	let div0;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let div1;
    	let t4;
    	let current;
    	const progressbar = new ProgressBar({ props: { progress: /*progress*/ ctx[3] } });

    	const button0 = new Button({
    			props: {
    				disabled: /*isRunning*/ ctx[1],
    				color: "red",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	button0.$on("click", /*click_handler*/ ctx[5]);

    	const button1 = new Button({
    			props: {
    				disabled: !/*isRunning*/ ctx[1],
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			}
    		});

    	button1.$on("click", /*click_handler_1*/ ctx[6]);

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text("Seconds Left: ");
    			t1 = text(/*secondsLeft*/ ctx[0]);
    			t2 = space();
    			create_component(progressbar.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			create_component(button0.$$.fragment);
    			t4 = space();
    			create_component(button1.$$.fragment);
    			attr(h2, "bp", "offset-5@md 4@md 12@sm");
    			attr(h2, "class", "svelte-1sj74pj");
    			attr(div0, "bp", "grid");
    			attr(div1, "class", "btns svelte-1sj74pj");
    			attr(div2, "class", "container");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, h2);
    			append(h2, t0);
    			append(h2, t1);
    			append(div2, t2);
    			mount_component(progressbar, div2, null);
    			append(div2, t3);
    			append(div2, div1);
    			mount_component(button0, div1, null);
    			append(div1, t4);
    			mount_component(button1, div1, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*secondsLeft*/ 1) set_data(t1, /*secondsLeft*/ ctx[0]);
    			const progressbar_changes = {};
    			if (dirty & /*progress*/ 8) progressbar_changes.progress = /*progress*/ ctx[3];
    			progressbar.$set(progressbar_changes);
    			const button0_changes = {};
    			if (dirty & /*isRunning*/ 2) button0_changes.disabled = /*isRunning*/ ctx[1];

    			if (dirty & /*$$scope*/ 128) {
    				button0_changes.$$scope = { dirty, ctx };
    			}

    			button0.$set(button0_changes);
    			const button1_changes = {};
    			if (dirty & /*isRunning*/ 2) button1_changes.disabled = !/*isRunning*/ ctx[1];

    			if (dirty & /*$$scope*/ 128) {
    				button1_changes.$$scope = { dirty, ctx };
    			}

    			button1.$set(button1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(progressbar.$$.fragment, local);
    			transition_in(button0.$$.fragment, local);
    			transition_in(button1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(progressbar.$$.fragment, local);
    			transition_out(button0.$$.fragment, local);
    			transition_out(button1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    			destroy_component(progressbar);
    			destroy_component(button0);
    			destroy_component(button1);
    		}
    	};
    }

    const totalSeconds = 20;

    function instance$5($$self, $$props, $$invalidate) {
    	let secondsLeft = totalSeconds;
    	let isRunning = false;
    	let stoped = false;

    	function startTimer() {
    		$$invalidate(2, stoped = false);
    		$$invalidate(1, isRunning = true);

    		const timer = setInterval(
    			() => {
    				$$invalidate(0, secondsLeft -= 1);

    				if (secondsLeft == 0 || stoped) {
    					clearInterval(timer);
    					$$invalidate(1, isRunning = false);
    					$$invalidate(0, secondsLeft = totalSeconds);
    				}
    			},
    			1000
    		);
    	}

    	const click_handler = () => startTimer();
    	const click_handler_1 = () => $$invalidate(2, stoped = true);
    	let progress;

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*secondsLeft*/ 1) {
    			 $$invalidate(3, progress = Math.round((totalSeconds - secondsLeft) / totalSeconds * 100));
    		}
    	};

    	return [
    		secondsLeft,
    		isRunning,
    		stoped,
    		progress,
    		startTimer,
    		click_handler,
    		click_handler_1
    	];
    }

    class Timer extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$7, safe_not_equal, {});
    	}
    }

    /* src/pages/Handwashing.svelte generated by Svelte v3.23.0 */

    function create_fragment$8(ctx) {
    	let h1;
    	let t1;
    	let t2;
    	let div0;
    	let t3;
    	let div1;
    	let current;
    	const timer = new Timer({});

    	return {
    		c() {
    			h1 = element("h1");
    			h1.textContent = "Handwashing Timer";
    			t1 = space();
    			create_component(timer.$$.fragment);
    			t2 = space();
    			div0 = element("div");
    			div0.innerHTML = `<img bp="offset-5@md 4@md 12@sm" src="images/handwashImage.gif" alt="How to wash your hands." class="svelte-13ttvtw">`;
    			t3 = space();
    			div1 = element("div");
    			div1.innerHTML = `<a href="https://www.who.int/gpsc/clean_hands_protection/en/">Picture source</a>`;
    			attr(h1, "class", "svelte-13ttvtw");
    			attr(div0, "bp", "margin-top--lg grid");
    			attr(div1, "bp", "margin-top--lg");
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    			insert(target, t1, anchor);
    			mount_component(timer, target, anchor);
    			insert(target, t2, anchor);
    			insert(target, div0, anchor);
    			insert(target, t3, anchor);
    			insert(target, div1, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(timer.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(timer.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			destroy_component(timer, detaching);
    			if (detaching) detach(t2);
    			if (detaching) detach(div0);
    			if (detaching) detach(t3);
    			if (detaching) detach(div1);
    		}
    	};
    }

    class Handwashing extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$8, safe_not_equal, {});
    	}
    }

    /* src/pages/Notes.svelte generated by Svelte v3.23.0 */

    function create_fragment$9(ctx) {
    	let h2;

    	return {
    		c() {
    			h2 = element("h2");
    			h2.textContent = "Notes";
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h2);
    		}
    	};
    }

    class Notes extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$9, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.0 */

    function create_if_block_3(ctx) {
    	let current;
    	const notes = new Notes({});

    	return {
    		c() {
    			create_component(notes.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(notes, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(notes.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(notes.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(notes, detaching);
    		}
    	};
    }

    // (42:43) 
    function create_if_block_2(ctx) {
    	let current;
    	const handwashing = new Handwashing({});

    	return {
    		c() {
    			create_component(handwashing.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(handwashing, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(handwashing.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(handwashing.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(handwashing, detaching);
    		}
    	};
    }

    // (40:37) 
    function create_if_block_1(ctx) {
    	let current;
    	const about = new About({});
    	about.$on("action", /*action_handler*/ ctx[8]);

    	return {
    		c() {
    			create_component(about.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(about, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(about.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(about.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(about, detaching);
    		}
    	};
    }

    // (38:2) {#if currentPage === '/home'}
    function create_if_block$1(ctx) {
    	let current;
    	const home = new Home({});

    	return {
    		c() {
    			create_component(home.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(home, detaching);
    		}
    	};
    }

    function create_fragment$a(ctx) {
    	let t0;
    	let updating_show;
    	let t1;
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;

    	const header = new Header({
    			props: { currentPage: /*currentPage*/ ctx[1] }
    		});

    	header.$on("click", /*click_handler*/ ctx[3]);
    	header.$on("changePage", /*changePage_handler*/ ctx[4]);

    	function sidenav_show_binding(value) {
    		/*sidenav_show_binding*/ ctx[5].call(null, value);
    	}

    	let sidenav_props = { currentPage: /*currentPage*/ ctx[1] };

    	if (/*sidebar_show*/ ctx[0] !== void 0) {
    		sidenav_props.show = /*sidebar_show*/ ctx[0];
    	}

    	const sidenav = new Sidenav({ props: sidenav_props });
    	binding_callbacks.push(() => bind(sidenav, "show", sidenav_show_binding));
    	sidenav.$on("closeNav", /*closeNav_handler*/ ctx[6]);
    	sidenav.$on("changePage", /*changePage_handler_1*/ ctx[7]);
    	const if_block_creators = [create_if_block$1, create_if_block_1, create_if_block_2, create_if_block_3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*currentPage*/ ctx[1] === "/home") return 0;
    		if (/*currentPage*/ ctx[1] === "/about") return 1;
    		if (/*currentPage*/ ctx[1] === "/handwashing") return 2;
    		if (/*currentPage*/ ctx[1] === "/notes") return 3;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	return {
    		c() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(sidenav.$$.fragment);
    			t1 = space();
    			main = element("main");
    			if (if_block) if_block.c();
    			attr(main, "class", "svelte-1awqykv");
    		},
    		m(target, anchor) {
    			mount_component(header, target, anchor);
    			insert(target, t0, anchor);
    			mount_component(sidenav, target, anchor);
    			insert(target, t1, anchor);
    			insert(target, main, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const header_changes = {};
    			if (dirty & /*currentPage*/ 2) header_changes.currentPage = /*currentPage*/ ctx[1];
    			header.$set(header_changes);
    			const sidenav_changes = {};
    			if (dirty & /*currentPage*/ 2) sidenav_changes.currentPage = /*currentPage*/ ctx[1];

    			if (!updating_show && dirty & /*sidebar_show*/ 1) {
    				updating_show = true;
    				sidenav_changes.show = /*sidebar_show*/ ctx[0];
    				add_flush_callback(() => updating_show = false);
    			}

    			sidenav.$set(sidenav_changes);
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(main, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(sidenav.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(sidenav.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach(t0);
    			destroy_component(sidenav, detaching);
    			if (detaching) detach(t1);
    			if (detaching) detach(main);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let sidebar_show = false;
    	let currentPage = "/";

    	const changePage = e => {
    		$$invalidate(1, currentPage = e);
    		$$invalidate(0, sidebar_show = false);
    		console.log("he");
    		console.log(currentPage);
    	};

    	const click_handler = () => $$invalidate(0, sidebar_show = !sidebar_show);
    	const changePage_handler = e => $$invalidate(1, currentPage = e.detail);

    	function sidenav_show_binding(value) {
    		sidebar_show = value;
    		$$invalidate(0, sidebar_show);
    	}

    	const closeNav_handler = () => $$invalidate(0, sidebar_show = false);
    	const changePage_handler_1 = e => changePage(e.detail);
    	const action_handler = e => console.log(e.detail);

    	return [
    		sidebar_show,
    		currentPage,
    		changePage,
    		click_handler,
    		changePage_handler,
    		sidenav_show_binding,
    		closeNav_handler,
    		changePage_handler_1,
    		action_handler
    	];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$a, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
