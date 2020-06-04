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

    /* src/UI/Header.svelte generated by Svelte v3.23.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (59:6) {#each navLinks as link}
    function create_each_block(ctx) {
    	let li;
    	let t_value = /*link*/ ctx[5] + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[4](/*link*/ ctx[5], ...args);
    	}

    	return {
    		c() {
    			li = element("li");
    			t = text(t_value);
    			attr(li, "class", "svelte-eb23zo");
    			toggle_class(li, "active", /*currentPage*/ ctx[0] === /*link*/ ctx[5]);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t);

    			if (!mounted) {
    				dispose = listen(li, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*currentPage, navLinks*/ 3) {
    				toggle_class(li, "active", /*currentPage*/ ctx[0] === /*link*/ ctx[5]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div1;
    	let div0;
    	let t1;
    	let nav;
    	let ul;
    	let each_value = /*navLinks*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.innerHTML = `<span>simmedia</span>`;
    			t1 = space();
    			nav = element("nav");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div0, "class", "logo");
    			attr(ul, "class", "svelte-eb23zo");
    			attr(nav, "class", "svelte-eb23zo");
    			attr(div1, "class", "header svelte-eb23zo");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div1, t1);
    			append(div1, nav);
    			append(nav, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*currentPage, navLinks, changePage*/ 7) {
    				each_value = /*navLinks*/ ctx[1];
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
    			if (detaching) detach(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let navLinks = ["Home", "About", "Handwashing", "Contact"];
    	let { currentPage } = $$props;
    	const dispatch = createEventDispatcher();

    	const changePage = e => {
    		dispatch("changePage", e);
    	};

    	const click_handler = link => changePage(link);

    	$$self.$set = $$props => {
    		if ("currentPage" in $$props) $$invalidate(0, currentPage = $$props.currentPage);
    	};

    	return [currentPage, navLinks, changePage, dispatch, click_handler];
    }

    class Header extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { currentPage: 0 });
    	}
    }

    /* src/UI/Button.svelte generated by Svelte v3.23.0 */

    function create_fragment$1(ctx) {
    	let button;
    	let button_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*$$slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

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
    				dispose = listen(button, "click", /*click_handler*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 8) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[3], dirty, null, null);
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

    function instance$1($$self, $$props, $$invalidate) {
    	let { mode = "" } = $$props;
    	let { color = "" } = $$props;
    	let { disabled = false } = $$props;
    	let { $$slots = {}, $$scope } = $$props;

    	function click_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$set = $$props => {
    		if ("mode" in $$props) $$invalidate(2, mode = $$props.mode);
    		if ("color" in $$props) $$invalidate(0, color = $$props.color);
    		if ("disabled" in $$props) $$invalidate(1, disabled = $$props.disabled);
    		if ("$$scope" in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	return [color, disabled, mode, $$scope, $$slots, click_handler];
    }

    class Button extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { mode: 2, color: 0, disabled: 1 });
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

    function create_fragment$2(ctx) {
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

    function instance$2($$self) {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
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

    function create_fragment$3(ctx) {
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

    function instance$3($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { progress: 0 });
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

    // (42:0) <Button disabled={!isRunning} on:click={() => (stoped = true)}>
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

    function create_fragment$4(ctx) {
    	let div;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
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
    			div = element("div");
    			h2 = element("h2");
    			t0 = text("Seconds Left: ");
    			t1 = text(/*secondsLeft*/ ctx[0]);
    			t2 = space();
    			create_component(progressbar.$$.fragment);
    			t3 = space();
    			create_component(button0.$$.fragment);
    			t4 = space();
    			create_component(button1.$$.fragment);
    			attr(h2, "bp", "offset-5@md 4@md 12@sm");
    			attr(h2, "class", "svelte-9jkpno");
    			attr(div, "bp", "grid");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			append(h2, t0);
    			append(h2, t1);
    			insert(target, t2, anchor);
    			mount_component(progressbar, target, anchor);
    			insert(target, t3, anchor);
    			mount_component(button0, target, anchor);
    			insert(target, t4, anchor);
    			mount_component(button1, target, anchor);
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
    			if (detaching) detach(div);
    			if (detaching) detach(t2);
    			destroy_component(progressbar, detaching);
    			if (detaching) detach(t3);
    			destroy_component(button0, detaching);
    			if (detaching) detach(t4);
    			destroy_component(button1, detaching);
    		}
    	};
    }

    const totalSeconds = 20;

    function instance$4($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src/pages/Handwashing.svelte generated by Svelte v3.23.0 */

    function create_fragment$5(ctx) {
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
    			h1.textContent = "Handwashing App";
    			t1 = space();
    			create_component(timer.$$.fragment);
    			t2 = space();
    			div0 = element("div");
    			div0.innerHTML = `<img bp="offset-5@md 4@md 12@sm" src="images/handwashImage.gif" alt="How to wash your hands." class="svelte-1l4n4r4">`;
    			t3 = space();
    			div1 = element("div");
    			div1.innerHTML = `<a href="https://www.who.int/gpsc/clean_hands_protection/en/">Picture source</a>`;
    			attr(h1, "class", "svelte-1l4n4r4");
    			attr(div0, "bp", "grid");
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
    		init(this, options, null, create_fragment$5, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.0 */

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

    // (36:34) 
    function create_if_block_1(ctx) {
    	let current;
    	const about = new About({});
    	about.$on("action", /*action_handler*/ ctx[2]);

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

    // (34:0) {#if currentPage === 'Home'}
    function create_if_block(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "Home Page";
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$6(ctx) {
    	let t;
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;

    	const header = new Header({
    			props: { currentPage: /*currentPage*/ ctx[0] }
    		});

    	header.$on("changePage", /*changePage_handler*/ ctx[1]);
    	const if_block_creators = [create_if_block, create_if_block_1, create_if_block_2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*currentPage*/ ctx[0] === "Home") return 0;
    		if (/*currentPage*/ ctx[0] === "About") return 1;
    		if (/*currentPage*/ ctx[0] === "Handwashing") return 2;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	return {
    		c() {
    			create_component(header.$$.fragment);
    			t = space();
    			main = element("main");
    			if (if_block) if_block.c();
    			attr(main, "class", "svelte-1e9puaw");
    		},
    		m(target, anchor) {
    			mount_component(header, target, anchor);
    			insert(target, t, anchor);
    			insert(target, main, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const header_changes = {};
    			if (dirty & /*currentPage*/ 1) header_changes.currentPage = /*currentPage*/ ctx[0];
    			header.$set(header_changes);
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
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach(t);
    			if (detaching) detach(main);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let currentPage = "Handwashing";
    	const changePage_handler = e => $$invalidate(0, currentPage = e.detail);
    	const action_handler = e => console.log(e.detail);
    	return [currentPage, changePage_handler, action_handler];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$6, safe_not_equal, {});
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
