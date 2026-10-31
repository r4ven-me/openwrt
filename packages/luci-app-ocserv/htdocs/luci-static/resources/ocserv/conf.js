'use strict';
'require baseclass';
'require fs';

/* ocserv configuration file model.

   Parses an ocserv.conf-style file (the OpenWrt template, config-per-user and
   config-per-group files) into lines and writes it back with minimal changes:
   comments and unknown lines are preserved, a changed directive is edited in
   place, a removed one is commented out, a new one re-uses a commented sample
   ("#key = value") or is appended.

   Licensed to the public under the Apache License 2.0.
*/

const DIR_RE = /^(\s*)((?:\|[A-Z0-9_]+\|)?)([a-z][a-z0-9_-]*)(\s*=\s*)(.*?)\s*$/;
const SAMPLE_RE = /^(#\s?)([a-z][a-z0-9_-]*)(\s*=\s*)(.*?)\s*$/;
const PLACEHOLDER_RE = /\|[A-Z0-9_]+\|/;

function parseLine(raw) {
	let m = DIR_RE.exec(raw);
	if (m)
		return { type: 'dir', indent: m[1], prefix: m[2], key: m[3], sep: m[4], value: m[5], raw };

	m = SAMPLE_RE.exec(raw);
	if (m)
		return { type: 'sample', lead: m[1], key: m[2], sep: m[3], value: m[4], raw };

	return { type: 'other', raw };
}

function render(l) {
	if (l.raw != null)
		return l.raw;
	if (l.type == 'dir')
		return l.indent + l.prefix + l.key + l.sep + l.value;
	return l.lead + l.key + l.sep + l.value;
}

function sameList(a, b) {
	return a.length == b.length && a.every((v, i) => v === b[i]);
}

class Model {
	constructor(text) {
		this.setText(text || '');
	}

	setText(text) {
		this.lines = String(text).replace(/\r\n/g, '\n').split('\n').map(parseLine);
	}

	serialize() {
		return this.lines.map(render).join('\n');
	}

	/* Directives whose value is filled in by the init script from UCI */
	isManaged(key) {
		return this.lines.some(l => l.type == 'dir' && l.key == key &&
			(l.prefix || PLACEHOLDER_RE.test(l.value)));
	}

	_active(key) {
		const res = [];
		this.lines.forEach((l, i) => {
			if (l.type == 'dir' && l.key == key && !l.prefix && !PLACEHOLDER_RE.test(l.value))
				res.push(i);
		});
		return res;
	}

	_samples(key) {
		const res = [];
		this.lines.forEach((l, i) => {
			if (l.type == 'sample' && l.key == key)
				res.push(i);
		});
		return res;
	}

	/* Active (uncommented, literal) values of a directive, as written in the file */
	get(key) {
		return this._active(key).map(i => this.lines[i].value);
	}

	has(key) {
		return this._active(key).length > 0;
	}

	set(key, values) {
		values = values.filter(v => v != null && v !== '');

		const act = this._active(key);
		if (sameList(act.map(i => this.lines[i].value), values))
			return;

		const common = Math.min(act.length, values.length);
		for (let i = 0; i < common; i++) {
			this.lines[act[i]].value = values[i];
			delete this.lines[act[i]].raw;
		}

		if (values.length < act.length) {
			for (let i = values.length; i < act.length; i++) {
				const l = this.lines[act[i]];
				this.lines[act[i]] = { type: 'sample', lead: '#', key: l.key, sep: l.sep, value: l.value };
			}
			return;
		}

		let extra = values.slice(act.length).map(v => ({
			type: 'dir', indent: '', prefix: '', key, sep: ' = ', value: v
		}));
		if (!extra.length)
			return;

		let at;
		if (act.length) {
			at = act[act.length - 1] + 1;
		}
		else {
			const smp = this._samples(key);
			if (smp.length) {
				const first = extra.shift();
				this.lines[smp[0]] = Object.assign(first, { sep: this.lines[smp[0]].sep });
				at = smp[0] + 1;
			}
			else {
				at = this.lines.length;
				if (at && this.lines[at - 1].type == 'other' && this.lines[at - 1].raw === '')
					at--;
			}
		}

		this.lines.splice(at, 0, ...extra);
	}
}

return baseclass.extend({
	Model,

	parse(text) {
		return new Model(text);
	},

	read(path) {
		return L.resolveDefault(fs.read(path), '').then(text => new Model(text));
	},

	write(path, model) {
		let text = model.serialize();
		if (text !== '' && !text.endsWith('\n'))
			text += '\n';
		return fs.write(path, text, 420 /* 0644 */);
	}
});
