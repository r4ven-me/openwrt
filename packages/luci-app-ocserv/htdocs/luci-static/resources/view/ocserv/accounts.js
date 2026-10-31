'use strict';
'require form';
'require fs';
'require ui';
'require uci';
'require ocserv.base as base';
'require ocserv.conf as conf';
'require ocserv.schema as schema';

/* Users & groups: plain-auth accounts and the per-user / per-group ocserv
   configuration files. Licensed to the public under the Apache License 2.0.
*/

const KINDS = {
	user: {
		dir: '/etc/ocserv/config-per-user',
		title: _('Per-user configuration'),
		descr: _('Each file in /etc/ocserv/config-per-user is applied to the user whose name matches the file name.'),
		nameTitle: _('User name')
	},
	group: {
		dir: '/etc/ocserv/config-per-group',
		title: _('Per-group configuration'),
		descr: _('Each file in /etc/ocserv/config-per-group is applied to the group whose name matches the file name.'),
		nameTitle: _('Group name')
	}
};

return L.view.extend({
	load() {
		return Promise.all([
			uci.load('ocserv'),
			L.resolveDefault(fs.list(KINDS.user.dir), []),
			L.resolveDefault(fs.list(KINDS.group.dir), [])
		]);
	},

	render([ , userFiles, groupFiles ]) {
		this.files = { user: userFiles, group: groupFiles };
		this.tables = {};

		const nodes = [];

		if (uci.get('ocserv', 'config', 'auth') === 'plain') {
			const m = new form.Map('ocserv', _('OpenConnect VPN'));
			const s = m.section(form.TableSection, 'ocservusers', _('Accounts'),
				_('Users that log in with a password (plain authentication). The group is matched with the per-group configuration below; "*" means any.'));
			s.anonymous = true;
			s.addremove = true;

			let o = s.option(form.Value, 'name', _('Name'));
			o.rmempty = false;
			o.datatype = 'uciname';

			o = s.option(form.Value, 'group', _('Group'));
			o.default = '*';

			o = s.option(form.Value, 'password', _('Password'));
			o.password = true;
			o.rmempty = false;

			nodes.push(m.render());
		}
		else {
			nodes.push(E('div', { 'class': 'cbi-map' }, [
				E('h2', _('OpenConnect VPN')),
				E('div', { 'class': 'cbi-map-descr' },
					_('Accounts with passwords are only used with "plain" authentication; the current method is "%s".').format(uci.get('ocserv', 'config', 'auth') || 'plain'))
			]));
		}

		for (const kind of Object.keys(KINDS))
			nodes.push(this.renderFiles(kind));

		return Promise.all(nodes).then(res => E('div', res));
	},

	renderFiles(kind) {
		const k = KINDS[kind];
		const table = E('table', { 'class': 'table' });
		const input = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': k.nameTitle });

		this.tables[kind] = table;
		this.fillFiles(kind);

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', k.title),
			E('div', { 'class': 'cbi-section-descr' }, k.descr),
			table,
			E('div', { 'class': 'cbi-section-create' }, [
				input, ' ',
				E('button', {
					'class': 'cbi-button cbi-button-add',
					'click': ui.createHandlerFn(this, 'handleAdd', kind, input)
				}, _('Add'))
			])
		]);
	},

	fillFiles(kind) {
		const k = KINDS[kind];
		const names = this.files[kind].filter(f => f.type == 'file').map(f => f.name).sort();

		const rows = names.map(name => E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, name),
			E('td', { 'class': 'td cbi-section-actions' }, [
				E('button', {
					'class': 'cbi-button cbi-button-edit',
					'click': ui.createHandlerFn(this, 'handleEdit', kind, name)
				}, _('Edit')),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-remove',
					'click': ui.createHandlerFn(this, 'handleDelete', kind, name)
				}, _('Delete'))
			])
		]));

		if (!rows.length)
			rows.push(E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td', 'colspan': 2 },
				E('em', _('No configuration files.')))));

		this.tables[kind].replaceChildren(
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, k.nameTitle),
				E('th', { 'class': 'th cbi-section-actions' }, '')
			]), ...rows);
	},

	refreshFiles(kind) {
		return L.resolveDefault(fs.list(KINDS[kind].dir), []).then(files => {
			this.files[kind] = files;
			this.fillFiles(kind);
		});
	},

	handleAdd(kind, input) {
		const name = input.value.trim();

		if (!/^[A-Za-z0-9_@][A-Za-z0-9._@-]*$/.test(name))
			return ui.addNotification(null, E('p', _('Invalid name: use letters, digits, ".", "_", "-" and "@".')), 'error');

		input.value = '';
		return this.handleEdit(kind, name);
	},

	handleDelete(kind, name) {
		if (!confirm(_('Delete the configuration file "%s"?').format(name)))
			return;

		return fs.remove(KINDS[kind].dir + '/' + name)
			.then(() => this.refreshFiles(kind))
			.catch(e => ui.addNotification(null, E('p', _('Failed to delete: %s').format(e.message)), 'error'));
	},

	handleEdit(kind, name) {
		const k = KINDS[kind];
		const path = k.dir + '/' + name;

		return conf.read(path).then(model => {
			const state = { text: model.serialize(), shown: model.serialize(), pendingRaw: null };
			const fm = new form.JSONMap({ cfg: {} }, null);
			const s = fm.section(form.NamedSection, 'cfg', 'cfg');

			s.tab('form', _('Settings'));
			s.tab('raw', _('Edit Template'));

			for (const spec of schema.PER_USER)
				base.addConfOption(s, 'form', spec, model);

			const o = s.taboption('raw', form.TextValue, '_raw',
				_('The configuration file as text. If this text is changed, it replaces the file and changes made in the Settings tab are discarded.'));
			o.rows = 15;
			o.monospace = true;
			o.rmempty = false;
			o.cfgvalue = () => state.shown;
			o.write = (sid, v) => { state.pendingRaw = v; };
			o.remove = o.write;

			const save = () => {
				state.pendingRaw = null;

				return fm.save().then(() => {
					if (state.pendingRaw != null)
						model.setText(state.pendingRaw);

					return L.resolveDefault(fs.exec('/bin/mkdir', [ '-p', k.dir ]), null)
						.then(() => base.flush(path, model, state.text));
				}).then(() => {
					ui.hideModal();
					return this.refreshFiles(kind);
				}).catch(e => ui.addNotification(null, E('p', _('Failed to save: %s').format(e.message)), 'error'));
			};

			return fm.render().then(node => {
				ui.showModal('%s: %s'.format(k.title, name), [
					node,
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, _('Dismiss')),
						' ',
						E('button', { 'class': 'cbi-button cbi-button-positive important', 'click': ui.createHandlerFn(this, save) }, _('Save'))
					])
				], 'cbi-modal');
			});
		});
	},

	handleSaveApply(ev) {
		return base.handleSaveApply(this, ev);
	}
});
