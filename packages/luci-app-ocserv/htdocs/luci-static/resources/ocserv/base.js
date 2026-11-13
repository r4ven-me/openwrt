'use strict';
'require baseclass';
'require form';
'require rpc';
'require ui';
'require uci';
'require ocserv.conf as conf';

/* Shared helpers for the OpenConnect VPN views: form options bound to an
   ocserv configuration file, and a Save / Save & Apply implementation that
   really commits UCI and restarts the service.

   Licensed to the public under the Apache License 2.0.
*/

const callRcInit = rpc.declare({
	object: 'rc',
	method: 'init',
	params: [ 'name', 'action' ]
});

const callRcList = rpc.declare({
	object: 'rc',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

const callUciCommit = rpc.declare({
	object: 'uci',
	method: 'commit',
	params: [ 'config' ]
});

const unquote = (v) => /^".*"$/.test(v) ? v.slice(1, -1) : v;
const normBool = (v) => /^(true|yes|1)$/i.test(v) ? 'true' : 'false';

/* Same behaviour for every form widget: the value lives in a conf.Model
   (this.conf) instead of UCI. */
const confMixin = {
	cfgvalue() {
		const vals = this.conf.get(this.confKey).map(v => this.confQuote ? unquote(v) : v);

		if (this.confList)
			return vals;
		if (!vals.length)
			return this.confFlag ? this.default : undefined;

		const v = vals[vals.length - 1];
		return this.confFlag ? normBool(v) : v;
	},

	write(section_id, value) {
		const vals = this.confList ? value : [ value ];
		this.conf.set(this.confKey, vals.map(v => this.confQuote ? '"' + v + '"' : v));
	},

	remove() {
		this.conf.set(this.confKey, []);
	}
};

const ConfValue = form.Value.extend(confMixin);
const ConfFlag = form.Flag.extend(confMixin);
const ConfList = form.ListValue.extend(confMixin);
const ConfDynList = form.DynamicList.extend(confMixin);

function addConfOption(s, tab, spec, model) {
	let Cls = ConfValue;

	if (spec.type == 'flag')
		Cls = ConfFlag;
	else if (spec.type == 'list')
		Cls = ConfDynList;
	else if (spec.type == 'enum')
		Cls = ConfList;

	const args = [ Cls, '_f_' + spec.key, spec.title, spec.desc ];
	const o = tab ? s.taboption(tab, ...args) : s.option(...args);

	o.conf = model;
	o.confKey = spec.key;
	o.confQuote = !!spec.quote;
	o.confList = spec.type == 'list';
	o.confFlag = spec.type == 'flag';
	o.rmempty = spec.type != 'flag';

	if (spec.type == 'flag') {
		o.enabled = 'true';
		o.disabled = 'false';
		o.default = spec.def ? 'true' : 'false';
	}
	else {
		o.optional = true;
		if (spec.datatype)
			o.datatype = spec.datatype;
		if (spec.def != null && spec.type != 'list')
			o.placeholder = String(spec.def);
		for (const v of spec.values || [])
			Array.isArray(v) ? o.value(v[0], v[1]) : o.value(v);
	}

	return o;
}

let filesChanged = false;

/* Rejects instead of hanging the page when a call takes too long */
function withTimeout(promise, ms, message) {
	return Promise.race([
		promise,
		new Promise((resolve, reject) => setTimeout(() => reject(new Error(message)), ms))
	]);
}

return baseclass.extend({
	addConfOption,
	withTimeout,

	/* "Service Control" row like on the pbr page: Start / Restart / Stop and Enable / Disable (start
	   on boot) of the ocserv init script. Restart and Stop drop every VPN session, including the
	   one the administrator may be using, so they ask first. Enable / Disable also write the "Enable
	   server" flag of the settings (UCI ocserv.config.enable), so that Save & Apply agrees with them;
	   syncFlag(enabled) lets the form show the new value. */
	serviceControl(syncFlag) {
		const box = E('div', { 'class': 'cbi-value-field' });
		const row = E('div', { 'class': 'cbi-value' }, [ E('label', { 'class': 'cbi-value-title' }, _('Service Control')), box ]);

		const draw = (st) => {
			const btn = (action, label, cls, off, warn) => E('button', {
				'class': 'btn cbi-button ' + cls,
				'disabled': off ? '' : null,
				'click': ui.createHandlerFn(this, () => {
					if (warn && !confirm(warn))
						return;
					return run(action);
				})
			}, label);

			box.replaceChildren(
				btn('start', _('Start'), 'cbi-button-positive', st.running),
				' ', btn('restart', _('Restart'), 'cbi-button-action', !st.running,
					_('Restart ocserv? All VPN sessions are dropped; if you reach LuCI through this VPN, reconnect afterwards.')),
				' ', btn('stop', _('Stop'), 'cbi-button-negative', !st.running,
					_('Stop ocserv? All VPN sessions are dropped; if you reach LuCI through this VPN, you cannot start it again from here.')),
				E('span', { 'style': 'display:inline-block;width:2em' }),
				btn('enable', _('Enable'), 'cbi-button-neutral', st.enabled),
				' ', btn('disable', _('Disable'), 'cbi-button-negative', !st.enabled));
		};

		const refresh = () => callRcList('ocserv').then(res => {
			const st = res.ocserv || {};
			draw({ running: !!st.running, enabled: !!st.enabled });
		}, () => draw({ running: false, enabled: false }));

		const setFlag = (enabled) => uci.load('ocserv').then(() => {
			uci.set('ocserv', 'config', 'enable', enabled ? '1' : '0');
			return uci.save();
		}).then(() => callUciCommit('ocserv')).then(() => {
			if (syncFlag)
				syncFlag(enabled);
		});

		const run = (action) => (action == 'enable' || action == 'disable' ? setFlag(action == 'enable') : Promise.resolve())
			.then(() => withTimeout(callRcInit('ocserv', action), 20000, _('The service did not answer in time.')))
			.then(() => ui.addNotification(null, E('p', _('Done: %s.').format(action)), 'info'),
				/* the answer never arrives when the session ran through the stopped service */
				() => ui.addNotification(null, E('p', _('No answer from the router. If you are connected through this VPN, reconnect, then reload the page.')), 'warning'))
			.then(() => new Promise(r => setTimeout(r, 1500)))
			.then(refresh);

		refresh();
		row.refresh = refresh;
		return row;
	},

	/* Shared table styles, loaded once per page */
	loadStyles() {
		if (document.getElementById('ocserv-css'))
			return;

		document.head.appendChild(E('link', {
			'id': 'ocserv-css',
			'rel': 'stylesheet',
			'href': L.resource('ocserv/ocserv.css')
		}));
	},

	/* Writes the model back when something changed */
	flush(path, model, original) {
		if (model.serialize() === original)
			return Promise.resolve(original);

		return conf.write(path, model).then(() => {
			filesChanged = true;
			return model.serialize();
		});
	},

	/* Native "Save & Apply": stage (form save), commit UCI, restart ocserv only if something changed.
	   A restart drops every VPN session, including the one the administrator may be using. */
	handleSaveApply(view, ev) {
		filesChanged = false;

		return view.handleSave(ev).then(() => uci.changes()).then(changes => {
			const pending = !!(changes && changes.ocserv && changes.ocserv.length);
			return callUciCommit('ocserv').then(() => pending || filesChanged);
		}).then(changed => {
			if (!changed) {
				ui.addNotification(null, E('p', _('There are no changes to apply; the service was not restarted.')), 'info');
				return;
			}

			return uci.load('ocserv').then(() => {
				const enable = uci.get('ocserv', 'config', 'enable');
				const tmo = _('The service did not answer in time.');

				if (enable === '0')
					return withTimeout(Promise.all([ callRcInit('ocserv', 'stop'), callRcInit('ocserv', 'disable') ]), 20000, tmo);

				return withTimeout(Promise.all([ callRcInit('ocserv', 'enable'), callRcInit('ocserv', 'restart') ]), 20000, tmo);
			}).then(() => {
				ui.addNotification(null, E('p', _('Configuration has been applied.')), 'info');
			}, () => {
				/* The configuration is already committed. A restart drops every VPN session, so
				   when the administrator reaches LuCI through this VPN, the answer never arrives
				   (timeout or "XHR request aborted"). This is expected, not a failed apply. */
				ui.hideModal();
				ui.addNotification(null, E('p', _('The configuration is saved and ocserv was restarted. If you are connected through this VPN, the restart has dropped your connection: reconnect, then reload the page.')), 'warning');
			});
		}).catch(e => {
			ui.addNotification(null, E('p', _('Failed to apply configuration: %s').format(e.message)), 'error');
		});
	}
});
