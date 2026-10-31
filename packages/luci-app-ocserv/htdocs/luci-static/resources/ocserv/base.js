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

return baseclass.extend({
	addConfOption,

	/* Writes the model back when something changed */
	flush(path, model, original) {
		if (model.serialize() === original)
			return Promise.resolve(original);

		return conf.write(path, model).then(() => model.serialize());
	},

	/* Native "Save & Apply": stage (form save), commit UCI, restart ocserv */
	handleSaveApply(view, ev) {
		return view.handleSave(ev).then(() => callUciCommit('ocserv')).then(() => {
			return uci.load('ocserv');
		}).then(() => {
			const enable = uci.get('ocserv', 'config', 'enable');

			if (enable === '0')
				return Promise.all([ callRcInit('ocserv', 'stop'), callRcInit('ocserv', 'disable') ]);

			return Promise.all([ callRcInit('ocserv', 'enable'), callRcInit('ocserv', 'restart') ]);
		}).then(() => {
			ui.addNotification(null, E('p', _('Configuration has been applied.')), 'info');
		}).catch(e => {
			ui.addNotification(null, E('p', _('Failed to apply configuration: %s').format(e.message)), 'error');
		});
	}
});
