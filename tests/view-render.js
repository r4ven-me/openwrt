// Renders every luci-app-amneziawg view against a minimal fake DOM that follows the semantics of
// LuCI's dom.create()/dom.append() (luci.js). Catches errors such as createElement('') before a build.
// Usage: node tests/view-render.js
'use strict';
const fs = require('fs');
const path = require('path');

const RES = path.join(__dirname, '..', 'packages', 'luci-app-amneziawg', 'htdocs', 'luci-static', 'resources');
const OC_RES = path.join(__dirname, '..', 'packages', 'luci-app-ocserv', 'htdocs', 'luci-static', 'resources');

class N {
	constructor(t) { this.tag = t; this.children = []; this.attrs = {}; this.value = ''; this.checked = false; this.selected = false; }
	appendChild(c) { this.children.push(c); return c; }
	get lastChild() { return this.children[this.children.length - 1]; }
	get firstChild() { return this.children[0]; }
	setAttribute(k, v) { this.attrs[k] = v; }
	addEventListener() {}
	removeChild() {}
	replaceChildren(...c) { this.children = c; }
	set innerHTML(v) { this.children.push(new N('#html')); }
}
const document = {
	createElement(t) { if (!t) throw new Error("createElement('') is not a valid element"); return new N(t); },
	createDocumentFragment() { return new N('#frag'); },
	createTextNode(t) { const n = new N('#text'); n.text = t; return n; },
	activeElement: null
};
const dom = {
	elem: n => n instanceof N,
	append(node, children) {
		if (Array.isArray(children)) {
			for (const c of children) {
				if (this.elem(c)) node.appendChild(c);
				else if (c != null) node.appendChild(document.createTextNode(`${c}`));
			}
			return node.lastChild;
		}
		if (this.elem(children)) return node.appendChild(children);
		if (children != null) node.appendChild(document.createTextNode(`${children}`));
		return null;
	},
	create(...a) {
		const html = a[0]; let attr = a[1], data = a[2], elem;
		if (!(attr instanceof Object) || Array.isArray(attr)) data = attr, attr = null;
		if (Array.isArray(html)) { elem = document.createDocumentFragment(); for (const h of html) elem.appendChild(this.create(h)); }
		else if (this.elem(html)) elem = html;
		else elem = document.createElement(html);
		if (attr) for (const k in attr) {
			if (attr[k] == null) continue;                       /* dom.attr() skips null/undefined */
			if (typeof attr[k] === 'function') { elem.attrs[k] = attr[k]; continue; }
			elem.attrs[k] = attr[k];
			if (k === 'value') elem.value = attr[k];
			if (k === 'checked' || k === 'selected') elem[k] = true;   /* setAttribute(k, false) still sets the attribute */
		}
		this.append(elem, data);
		return elem;
	}
};

global.document = document;
global.E = (...a) => dom.create(...a);
global._ = s => s;
String.prototype.format = function () { let i = 0; const a = arguments; return this.replace(/%[ds]/g, () => a[i++]); };
global.confirm = () => true;

const baseclass = { extend: o => Object.assign(Object.create(null), o) };
const rpc = { declare: () => () => Promise.resolve({}) };
const ui = {
	DynamicList: class { constructor(v) { this.v = v; } render() { return E('div'); } getValue() { return this.v; } },
	createHandlerFn: (ctx, fn, ...a) => () => ctx[fn](...a),
	addNotification(t, n, level) { ui.notes.push(level); }, notes: [], showModal(title, body) { ui.lastModal = body; }, hideModal() {}
};
const qrcode = { make: () => '<svg/>' };
const L = { view: { extend: o => o }, resolveDefault: p => p };

/* evaluates a LuCI module: strips the 'require' lines and injects the required modules as parameters */
function load(file, deps, res = RES) {
	const src = fs.readFileSync(path.join(res, file), 'utf8').replace(/^'require [^\n]*\n/gm, '');
	const names = Object.keys(deps);
	return new Function(...names, src)(...names.map(n => deps[n]));
}

const awg = load('amneziawg/common.js', { baseclass, rpc, ui });
const base = { baseclass, rpc, ui, L, poll: { add() {} }, qrcode, awg };

const peers = [
	{ name: 'phone', address: '10.8.0.2', endpoint: null, handshake: 0, rx: 0, tx: 0, enabled: true, via: '', dest: [] },
	{ name: 'laptop', address: '10.8.0.3', endpoint: '1.2.3.4:5', handshake: 1793180000, rx: 1024, tx: 2048, enabled: false, via: 'wan', dest: [ '1.1.1.1', '10.0.0.0/8' ] }
];
const list = (over) => Object.assign({ configured: true, iface: 'awg0', endpoint: 'h:1', address: '10.8.0.1/24', port: 51820, up: true, pbr: true, filter: false, peers, interfaces: [ 'lan', 'wan' ] }, over);
const obf = { jc: '8', jmin: '38', jmax: '401', s1: '80', s2: '141', s3: '82', s4: '109', h1: '1-2', h2: '3-4', h3: '5-6', h4: '7-8', i1: '', i2: '', i3: '', i4: '', i5: '' };
const settings = (over) => Object.assign({
	configured: true, iface: 'awg0',
	config: { host: 'h', port: 443, dns: [ '9.9.9.9' ], allowed_ips: [ '0.0.0.0/0' ], mtu: null, keepalive: 25, obf: { jc: '', jmin: '', jmax: '', i1: '', i2: '', i3: '', i4: '', i5: '' } },
	interface: { address: '10.8.0.1/24', port: 51820, mtu: null, obf, zones: [ { name: 'lan', masq: false }, { name: 'wan', masq: true } ], forward: [ 'wan' ], filter: false }
}, over);

const cases = [
	[ 'view/amneziawg/peers.js', 'peers: not configured', { configured: false } ],
	[ 'view/amneziawg/peers.js', 'peers: configured, pbr', list() ],
	[ 'view/amneziawg/peers.js', 'peers: filter on', list({ filter: true }) ],
	[ 'view/amneziawg/peers.js', 'peers: no pbr, no peers', list({ pbr: false, peers: [], up: false }) ],
	[ 'view/amneziawg/config.js', 'config: not configured', { configured: false } ],
	[ 'view/amneziawg/config.js', 'config: configured', settings() ],
	[ 'view/amneziawg/interface.js', 'interface: not configured', { configured: false } ],
	[ 'view/amneziawg/interface.js', 'interface: configured', settings() ],
	[ 'view/amneziawg/interface.js', 'interface: filter on, no zones', settings({ interface: Object.assign({}, settings().interface, { zones: [], forward: [], filter: true }) }) ]
];

let failed = 0;
for (const [file, label, data] of cases) {
	try {
		const view = load(file, base);
		const out = view.render(data);
		if (!out) throw new Error('render() returned nothing');
		console.log('OK  ', label);
	} catch (e) {
		failed++;
		console.log('FAIL', label, '-', e.message);
	}
}

/* button handlers: the arguments that reach the backend */
const calls = [];
for (const m of Object.keys(awg)) {
	if (typeof awg[m] === 'function' && !['row','input','actions','button','notify','handle','fmtBytes','fmtHandshake','ip4ToInt','obfLabels'].includes(m))
		awg[m] = (...a) => { calls.push([ m, a ]); return Promise.resolve({ ok: true, obf: {} }); };
}
awg.handle = (p) => p;
function expect(label, cond) { if (cond) console.log('OK  ', label); else { failed++; console.log('FAIL', label); } }

(async () => {
	let v = load('view/amneziawg/config.js', base);
	v.render(settings());
	v.fields.host.value = ' vpn.example.com '; v.fields.port.value = '443'; v.fields.mtu.value = '1280'; v.fields.keepalive.value = '0';
	v.fields.obf.jc.value = '7';
	await v.save();
	const c = calls.find(x => x[0] === 'setConfig');
	expect('config save -> set_config(host, port, dns, allowed, mtu, keepalive, obf)',
		c && c[1][0] === 'vpn.example.com' && c[1][1] === 443 && c[1][2][0] === '9.9.9.9' && c[1][4] === 1280 && c[1][5] === 0 && c[1][6].jc === '7');

	calls.length = 0;
	v = load('view/amneziawg/interface.js', base);
	v.render(settings());
	v.fields.port.value = '443'; v.fields.mtu.value = ''; v.fields.zones.lan.checked = true; v.fields.filter.checked = true;
	await v.save();
	const i = calls.find(x => x[0] === 'setInterface');
	expect('interface save -> set_interface(port, mtu=1420 default, obf, zones, filter)',
		i && i[1][0] === 443 && i[1][1] === 1420 && i[1][2].s1 === '80' && i[1][3].join() === 'lan,wan' && i[1][4] === true);

	calls.length = 0;
	v.fields.port.value = '70000';
	await v.save();
	expect('interface save rejects an invalid port without calling the backend', !calls.some(x => x[0] === 'setInterface'));

	/* peers page: add form sends the optional address, the edit dialog calls set_peer_address */
	const find = (node, pred, acc = []) => { if (pred(node)) acc.push(node); (node.children || []).forEach(c => find(c, pred, acc)); return acc; };
	calls.length = 0;
	v = load('view/amneziawg/peers.js', base);
	const page = v.render(list());
	const nameIn = find(page, n => n.tag === 'input' && n.attrs.placeholder === 'Peer name')[0];
	const addrIn = find(page, n => n.tag === 'input' && n.attrs.placeholder === 'IP address (optional)')[0];
	const addBtn = find(page, n => n.tag === 'button' && /cbi-button-add/.test(n.attrs.class))[0];
	nameIn.value = 'tablet'; addrIn.value = ' 10.8.0.50 ';
	await addBtn.attrs.click();
	let a = calls.find(x => x[0] === 'addPeer');
	expect('add peer sends name, via and the typed address', a && a[1][0] === 'tablet' && a[1][1] === '' && a[1][2] === '10.8.0.50');

	calls.length = 0;
	addrIn.value = '';
	await addBtn.attrs.click();
	a = calls.find(x => x[0] === 'addPeer');
	expect('add peer without an address sends an empty one (auto)', a && a[1][2] === '');

	calls.length = 0;
	v.editAddress(list().peers[0]);
	const modal = { children: ui.lastModal };
	const mIn = find(modal, n => n.tag === 'input')[0];
	const mSave = find(modal, n => n.tag === 'button' && /cbi-button-save/.test(n.attrs.class))[0];
	mIn.value = '10.8.0.77';
	await mSave.attrs.click();
	a = calls.find(x => x[0] === 'setPeerAddress');
	expect('edit address dialog -> set_peer_address(name, address)', a && a[1][0] === 'phone' && a[1][1] === '10.8.0.77');

	/* what the user sees must match the data: exactly the stored values are selected/checked */
	const sel = (via) => {
		const pg = load('view/amneziawg/peers.js', base).render(list({ peers: [ Object.assign({}, peers[0], { via }) ] }));
		const select = find(pg, n => n.tag === 'select')[0];
		return find(select, n => n.tag === 'option' && n.selected).map(o => o.attrs.value);
	};
	expect('exit interface select: via=wan selects only wan', sel('wan').join() === 'wan');
	expect('exit interface select: via empty selects only the default route', sel('').join() === '');
	expect('exit interface select: a stale via stays selected', sel('gone').join() === 'gone');

	v = load('view/amneziawg/interface.js', base);
	v.render(settings());
	expect('interface page: only the forwarded zone is checked', v.fields.zones.wan.checked === true && v.fields.zones.lan.checked === false);
	expect('interface page: filtering is unchecked when it is off', v.fields.filter.checked === false);

	/* the real handle(): errors and backend warnings become notifications */
	const real = load('amneziawg/common.js', { baseclass, rpc, ui });
	ui.notes.length = 0;
	await real.handle(Promise.resolve({ ok: true, warning: 'no masquerading' }));
	await real.handle(Promise.resolve({ error: 'boom' }));
	expect('handle(): a warning and an error are both shown', ui.notes.join() === 'warning,error');

	/* the standard LuCI footer: Save & Apply and Reset exist, plain Save is hidden */
	for (const f of [ 'peers', 'config', 'interface' ]) {
		const view = load('view/amneziawg/' + f + '.js', base);
		expect(f + ': footer has Save & Apply and Reset, no plain Save',
			typeof view.handleSaveApply === 'function' && typeof view.handleReset === 'function' && view.handleSave === null);
	}

	/* peers: table edits are staged until Save & Apply */
	calls.length = 0;
	awg.list = () => Promise.resolve(list());      /* what the router returns after an apply */
	v = load('view/amneziawg/peers.js', base);
	const pg = v.render(list());
	const selEl = () => find(v.root, n => n.tag === 'select')[0];
	const cbEl = () => find(v.root, n => n.tag === 'input' && n.attrs.type === 'checkbox')[0];
	selEl().attrs.change({ target: { value: 'wan' } });
	cbEl().attrs.change({ target: { checked: false } });
	expect('peers: edits do not reach the backend by themselves', calls.length === 0);
	expect('peers: edits are remembered and shown as unsaved',
		v.pending.phone && v.pending.phone.enabled === false && v.pending.phone.via === 'wan' &&
		find(v.root, n => n.tag === 'p' && /Unsaved changes/.test(JSON.stringify(n.children))).length === 1);
	await v.handleSaveApply();
	expect('peers: Save & Apply sends set_enabled then set_route',
		calls.length >= 2 && calls[0][0] === 'setEnabled' && calls[0][1][0] === 'phone' && calls[0][1][1] === false &&
		calls[1][0] === 'setRoute' && calls[1][1][0] === 'phone' && calls[1][1][1] === 'wan');
	expect('peers: nothing is pending afterwards', Object.keys(v.pending).length === 0);

	calls.length = 0;
	selEl().attrs.change({ target: { value: 'wan' } });
	selEl().attrs.change({ target: { value: '' } });
	expect('peers: changing a value back drops the edit', Object.keys(v.pending).length === 0);
	selEl().attrs.change({ target: { value: 'wan' } });
	v.handleReset();
	await v.handleSaveApply();
	expect('peers: Reset discards edits, Save & Apply then has nothing to send', calls.length === 0);

	/* config/interface: Save & Apply sends the form */
	calls.length = 0;
	v = load('view/amneziawg/config.js', base);
	v.render(settings());
	v.fields.host.value = 'h'; v.fields.port.value = '443'; v.fields.keepalive.value = '25';
	await v.handleSaveApply();
	expect('config: Save & Apply -> set_config', calls.some(x => x[0] === 'setConfig'));
	calls.length = 0;
	v = load('view/amneziawg/interface.js', base);
	v.render(settings());
	await v.handleSaveApply();
	expect('interface: Save & Apply -> set_interface', calls.some(x => x[0] === 'setInterface'));

	/* ocserv: the users/certificates page */
	const ocCerts = [
		{ cn: 'alice', serial: '02', status: 'valid', expires: '2036-10-26 15:08', revoked: null, has_p12: true, has_key: true, has_crt: true, ip: '10.10.100.2', via: 'oc0' },
		{ cn: 'old', serial: '01', status: 'valid', expires: '2036-10-26 15:08', revoked: null, has_p12: true, has_key: false, has_crt: true, ip: '', via: '' },
		{ cn: 'gone', serial: '03', status: 'revoked', expires: '2036-10-26 15:08', revoked: '2026-10-29 10:00', has_p12: false, has_key: false, has_crt: false, ip: '', via: '' }
	];
	for (const data of [ {}, { certs: ocCerts, ca: true, ifaces: [ 'wan', 'oc0' ], pbr: true }, { certs: ocCerts, ca: true, ifaces: [], pbr: false } ]) {
		try {
			const out = load('view/ocserv/certs.js', { rpc, ui, L }, OC_RES).render(data);
			if (!out) throw new Error('render() returned nothing');
			console.log('OK   ocserv certs: render');
		} catch (e) {
			failed++;
			console.log('FAIL ocserv certs: render -', e.message);
		}
	}

	process.exit(failed ? 1 : 0);
})();
