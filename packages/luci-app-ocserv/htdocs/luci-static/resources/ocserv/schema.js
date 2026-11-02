'use strict';
'require baseclass';

/* Directive descriptions for the ocserv configuration forms.

   type:  flag | int | str | enum | list
   uci:   the directive is filled in from this UCI option by the init script
          while the template still contains a |PLACEHOLDER| for it
   quote: the value is written in double quotes
   def:   value assumed by ocserv when the directive is absent

   Licensed to the public under the Apache License 2.0.
*/

const TABS = [
	[ 'general',   _('General Settings') ],
	[ 'network',   _('Network') ],
	[ 'auth',      _('Authentication & TLS') ],
	[ 'timers',    _('Timers') ],
	[ 'security',  _('Security') ],
	[ 'system',    _('System') ],
	[ 'camouflage', _('Camouflage') ],
	[ 'headers',   _('HTTP headers') ]
];

const GLOBAL_KEYS = [
	'tcp-port', 'udp-port', 'listen-host', 'max-clients', 'rate-limit-ms', 'log-level',
	'isolate-workers', 'device', 'ping-leases', 'route-add-cmd', 'route-del-cmd',
	'try-mtu-discovery', 'auth-timeout', 'server-stats-reset-time',
	'max-ban-score', 'ban-reset-time', 'ban-points-wrong-password',
	'ban-points-connection', 'ban-points-kkdcp',
	'connect-script', 'disconnect-script', 'use-utmp', 'use-occtl', 'occtl-socket-file',
	'pid-file', 'chroot-dir', 'socket-file', 'run-as-user', 'run-as-group'
];

function scope(spec) {
	const key = typeof(spec) == 'string' ? spec : spec.key;
	return GLOBAL_KEYS.includes(key) ? 'global' : 'vhost';
}

const SERVER = [
	/* general */
	{ key: 'banner', type: 'str', quote: true, tab: 'general', title: _('Banner'),
	  desc: _('A banner to be displayed on clients after connection') },
	{ key: 'pre-login-banner', type: 'str', quote: true, tab: 'general', title: _('Pre-login banner'),
	  desc: _('A banner to be displayed on clients before connection') },
	{ key: 'tcp-port', type: 'int', tab: 'general', title: _('Port'), uci: 'port', datatype: 'port',
	  desc: _('The same UDP and TCP ports will be used unless a separate UDP port is set') },
	{ key: 'udp-port', type: 'int', tab: 'general', title: _('UDP port'), uci: 'udp_port', datatype: 'port',
	  desc: _('Leave empty to use the TCP port') },
	{ key: 'listen-host', type: 'str', tab: 'general', title: _('Listen host'),
	  desc: _('Limit to specific IPs or to the IPs of a provided hostname') },
	{ key: 'max-clients', type: 'int', tab: 'general', title: _('Max clients'), uci: 'max_clients', datatype: 'uinteger',
	  desc: _('Limit the number of clients. Unset or zero for unlimited.') },
	{ key: 'max-same-clients', type: 'int', tab: 'general', title: _('Max same clients'), uci: 'max_same', datatype: 'uinteger',
	  desc: _('Limit the number of identical clients (users connecting multiple times). Unset or zero for unlimited.') },
	{ key: 'rate-limit-ms', type: 'int', tab: 'general', title: _('Connection rate limit (ms)'), datatype: 'uinteger',
	  desc: _('Rate limit incoming connections to one every X milliseconds. Zero for no limit.') },
	{ key: 'isolate-workers', type: 'flag', tab: 'general', title: _('Isolate workers'), def: true },
	{ key: 'log-level', type: 'enum', tab: 'general', title: _('Log level'), datatype: 'uinteger',
	  values: [ [ '0', _('0 - default') ], [ '1', _('1 - basic') ], [ '2', _('2 - info') ], [ '3', _('3 - debug') ],
	            [ '4', _('4 - http') ], [ '8', _('8 - sensitive') ], [ '9', _('9 - TLS') ] ] },

	/* network */
	{ key: 'device', type: 'str', tab: 'network', title: _('Tunnel device name'), def: 'vpns' },
	{ key: 'predictable-ips', type: 'flag', tab: 'network', title: _('Predictable IPs'), uci: 'predictable_ips', ucidef: '1', def: true,
	  desc: _('The assigned IPs will be selected deterministically') },
	{ key: 'default-domain', type: 'str', tab: 'network', title: _('Default domain'), uci: 'default_domain',
	  desc: _('The default domain to be advertised') },
	{ key: 'ipv4-network', type: 'str', tab: 'network', title: _('VPN IPv4-Network-Address'), uci: 'ipaddr', datatype: 'ip4addr',
	  desc: _('The IPv4 subnet address to provide to clients; this should be some private network different than the LAN addresses unless proxy ARP is enabled. Leave empty to attempt auto-configuration.') },
	{ key: 'ipv4-netmask', type: 'str', tab: 'network', title: _('VPN IPv4-Netmask'), uci: 'netmask', datatype: 'ip4addr',
	  values: [ '255.255.255.0', '255.255.0.0', '255.0.0.0' ], desc: _('The mask of the subnet above.') },
	{ key: 'ipv6-network', type: 'str', tab: 'network', title: _('VPN IPv6-Network-Address'), uci: 'ip6addr', datatype: 'ip6addr', ipv6: true,
	  desc: _('The IPv6 subnet that leases will be given from, in CIDR notation: address/prefix. Leave empty to attempt auto-configuration.') },
	{ key: 'dns', type: 'list', tab: 'network', title: _('DNS servers (from template)'), datatype: 'ipaddr',
	  desc: _('Advertised DNS servers, IPv4 or IPv6. Servers added in the DNS servers table below are appended by the init script.') },
	{ key: 'nbns', type: 'list', tab: 'network', title: _('NBNS servers'), datatype: 'ipaddr' },
	{ key: 'split-dns', type: 'flag', tab: 'network', title: _('Split DNS'), uci: 'split_dns', ucidef: '0', def: false,
	  desc: _('Use the provided DNS only for the default domain') },
	{ key: 'ping-leases', type: 'flag', tab: 'network', title: _('Ping leases'), uci: 'ping_leases', ucidef: '0', def: false,
	  desc: _('Ping an address before leasing it to verify that it is not in use by another host') },
	{ key: 'tunnel-all-dns', type: 'flag', tab: 'network', title: _('Tunnel all DNS'),
	  desc: _('Tunnel all DNS queries via the VPN. This is the default when a default route is set.') },
	{ key: 'mtu', type: 'int', tab: 'network', title: _('MTU'), datatype: 'uinteger',
	  desc: _('Unset to assign the default MTU of the device') },
	{ key: 'rx-data-per-sec', type: 'int', tab: 'network', title: _('Upload limit (bytes/s)'), datatype: 'uinteger',
	  desc: _('Bandwidth restriction, global; can also be set per user or per group') },
	{ key: 'tx-data-per-sec', type: 'int', tab: 'network', title: _('Download limit (bytes/s)'), datatype: 'uinteger',
	  desc: _('Bandwidth restriction, global; can also be set per user or per group') },
	{ key: 'output-buffer', type: 'int', tab: 'network', title: _('Output buffer (packets)'), datatype: 'uinteger',
	  desc: _('Packets of MTU size available in the output buffer. Higher improves throughput, lower improves latency.') },
	{ key: 'route', type: 'list', tab: 'network', title: _('Routes (from template)'),
	  desc: _('Routes forwarded to the client as network/mask. Routes added in the Routing table below are appended by the init script. Without any routes the server is the default gateway.') },
	{ key: 'net-priority', type: 'int', tab: 'network', title: _('Network priority'), datatype: 'uinteger',
	  desc: _('Protocol-defined priority (SO_PRIORITY, 0 to 6) or IP TOS as hexadecimal (e.g. 0x20)') },
	{ key: 'cgroup', type: 'str', quote: true, tab: 'network', title: _('Cgroup'),
	  desc: _('Put the VPN worker process into a specific cgroup, e.g. cpuset,cpu:test') },
	{ key: 'expose-iroutes', type: 'flag', tab: 'network', title: _('Expose iroutes'), def: false },
	{ key: 'route-add-cmd', type: 'str', quote: true, tab: 'network', title: _('Route add command'),
	  desc: _('%{R} is replaced with route/mask and %{D} with the tun device') },
	{ key: 'route-del-cmd', type: 'str', quote: true, tab: 'network', title: _('Route delete command') },
	{ key: 'proxy-url', type: 'str', tab: 'network', title: _('Proxy URL'),
	  desc: _('Forward a proxy to clients. %{U} and %{G} are replaced by the user and group name.') },
	{ key: 'client-bypass-protocol', type: 'flag', tab: 'network', title: _('Client bypass protocol'), def: false,
	  desc: _('Instruct AnyConnect clients to bypass the server for an IP protocol without a configured address pool') },
	{ key: 'config-per-user', type: 'str', tab: 'network', title: _('Per-user config directory') },
	{ key: 'config-per-group', type: 'str', tab: 'network', title: _('Per-group config directory') },
	{ key: 'default-user-config', type: 'str', tab: 'network', title: _('Default user config'),
	  desc: _('Used when config-per-user is set and there is no file for the user') },
	{ key: 'default-group-config', type: 'str', tab: 'network', title: _('Default group config') },
	{ key: 'select-group', type: 'list', tab: 'network', title: _('Selectable groups'),
	  desc: _('Groups a client may select before authentication: name or name[Display name]') },
	{ key: 'default-select-group', type: 'str', tab: 'network', title: _('Default selectable group') },
	{ key: 'auto-select-group', type: 'flag', tab: 'network', title: _('Auto select groups'),
	  desc: _('Scan all available groups and include the full list. Only functional with plain authentication.') },

	/* authentication & tls */
	{ key: 'server-cert', type: 'str', tab: 'auth', title: _('Server certificate'), uci: 'server_cert',
	  desc: _('Path to the server certificate; may be repeated in the file for multiple key pairs') },
	{ key: 'server-key', type: 'str', tab: 'auth', title: _('Server key'), uci: 'server_key' },
	{ key: 'ca-cert', type: 'str', tab: 'auth', title: _('CA certificate'),
	  desc: _('Certificate Authority used to verify client certificates when certificate authentication is set') },
	{ key: 'cert-user-oid', type: 'str', tab: 'auth', title: _('User ID OID'),
	  values: [ [ '2.5.4.3', _('CN (2.5.4.3)') ], [ '0.9.2342.19200300.100.1.1', _('UID (0.9.2342.19200300.100.1.1)') ] ],
	  desc: _('Object identifier read from the client certificate to obtain the user ID') },
	{ key: 'cert-group-oid', type: 'str', tab: 'auth', title: _('Group OID'),
	  values: [ [ '2.5.4.11', _('OU (2.5.4.11)') ] ],
	  desc: _('Object identifier read from the client certificate to obtain the user group') },
	{ key: 'crl', type: 'str', tab: 'auth', title: _('Revocation list (CRL)'),
	  desc: _('Revocation list of the certificates issued by the CA above') },
	{ key: 'dh-params', type: 'str', tab: 'auth', title: _('DH parameters'),
	  desc: _('Only needed for the DHE ciphersuites; ECDHE is supported by default') },
	{ key: 'ocsp-response', type: 'str', tab: 'auth', title: _('OCSP response file') },
	{ key: 'pin-file', type: 'str', tab: 'auth', title: _('PIN file'),
	  desc: _('PIN for PKCS #11 or TPM keys') },
	{ key: 'srk-pin-file', type: 'str', tab: 'auth', title: _('SRK PIN file'),
	  desc: _('Storage root key PIN, TPM keys only') },
	{ key: 'compression', type: 'flag', tab: 'auth', title: _('Enable compression'), uci: 'compression', ucidef: '0', def: false,
	  desc: _('Enable compression negotiation (LZS, LZ4)') },
	{ key: 'tls-priorities', type: 'str', quote: true, tab: 'auth', title: _('TLS priorities'),
	  desc: _('GnuTLS priority string') },
	{ key: 'cisco-client-compat', type: 'flag', tab: 'auth', title: _('AnyConnect client compatibility'),
	  uci: 'cisco_compat', ucidef: '1', def: true,
	  desc: _('Enable support for CISCO AnyConnect clients') },
	{ key: 'user-profile', type: 'str', tab: 'auth', title: _('Client profile XML'),
	  desc: _('Must be accessible from inside the worker chroot. Not used by the openconnect client.') },
	{ key: 'binary-files', type: 'str', tab: 'auth', title: _('Binary files directory'),
	  desc: _('Binary files that may be downloaded by the CISCO client') },
	{ key: 'custom-header', type: 'list', quote: true, tab: 'auth', title: _('Custom headers'),
	  desc: _('Arbitrary headers sent to the client after authentication, e.g. X-My-Header: hi there') },

	/* timers */
	{ key: 'keepalive', type: 'int', tab: 'timers', title: _('Keepalive (secs)'), datatype: 'uinteger' },
	{ key: 'dpd', type: 'int', tab: 'timers', title: _('Dead peer detection time (secs)'), uci: 'dpd', datatype: 'uinteger' },
	{ key: 'mobile-dpd', type: 'int', tab: 'timers', title: _('Mobile dead peer detection (secs)'), datatype: 'uinteger',
	  desc: _('For mobile clients; must be much higher to save battery') },
	{ key: 'switch-to-tcp-timeout', type: 'int', tab: 'timers', title: _('Switch to TCP timeout (secs)'), datatype: 'uinteger',
	  desc: _('If no UDP traffic is received for this long, send traffic over TCP to wake up the client. Unset to disable.') },
	{ key: 'try-mtu-discovery', type: 'flag', tab: 'timers', title: _('MTU discovery'), def: false,
	  desc: _('DPD must be enabled') },
	{ key: 'auth-timeout', type: 'int', tab: 'timers', title: _('Authentication timeout (secs)'), datatype: 'uinteger',
	  desc: _('How long a client may stay connected prior to authentication') },
	{ key: 'idle-timeout', type: 'int', tab: 'timers', title: _('Idle timeout (secs)'), datatype: 'uinteger',
	  desc: _('Unset to disable') },
	{ key: 'mobile-idle-timeout', type: 'int', tab: 'timers', title: _('Mobile idle timeout (secs)'), datatype: 'uinteger',
	  desc: _('Unset to disable') },
	{ key: 'min-reauth-time', type: 'int', tab: 'timers', title: _('Minimum reauthentication time (secs)'), datatype: 'uinteger',
	  desc: _('How long a client is not allowed to reconnect after a failed authentication attempt') },
	{ key: 'cookie-timeout', type: 'int', tab: 'timers', title: _('Cookie timeout (secs)'), datatype: 'uinteger',
	  desc: _('An unused cookie is invalidated after this time; it should allow reasonable roaming between networks') },
	{ key: 'persistent-cookies', type: 'flag', tab: 'timers', title: _('Persistent cookies'), def: false,
	  desc: _('Cookies stay valid after a manual disconnect until they expire (not recommended)') },
	{ key: 'deny-roaming', type: 'flag', tab: 'timers', title: _('Deny roaming'), def: false,
	  desc: _('Restrict a cookie to a single IP address') },
	{ key: 'rekey-time', type: 'int', tab: 'timers', title: _('Rekey time (secs)'), datatype: 'uinteger',
	  desc: _('Zero disables rekeying; some clients fail if it is disabled') },
	{ key: 'rekey-method', type: 'enum', tab: 'timers', title: _('Rekey method'),
	  values: [ [ 'ssl', _('ssl - seamless rehandshake') ], [ 'new-tunnel', _('new-tunnel - re-establish the channel') ] ] },
	{ key: 'server-stats-reset-time', type: 'int', tab: 'timers', title: _('Statistics reset time (secs)'), datatype: 'uinteger',
	  desc: _('Period after which the statistics shown by "occtl show stats" are reset. Daily: 86400, weekly: 604800.') },
	{ key: 'stats-report-time', type: 'int', tab: 'timers', title: _('Statistics report time (secs)'), datatype: 'uinteger',
	  desc: _('How often each worker reports usage statistics; useful with accounting such as RADIUS') },

	/* security */
	{ key: 'max-ban-score', type: 'int', tab: 'security', title: _('Max ban score'), datatype: 'uinteger',
	  desc: _('IP addresses with a higher score are banned for the minimum reauthentication time. Zero disables banning.') },
	{ key: 'ban-reset-time', type: 'int', tab: 'security', title: _('Ban reset time (secs)'), datatype: 'uinteger',
	  desc: _('Time after which all score kept for a client is reset') },
	{ key: 'ban-points-wrong-password', type: 'int', tab: 'security', title: _('Points: wrong password'), datatype: 'uinteger', def: 10 },
	{ key: 'ban-points-connection', type: 'int', tab: 'security', title: _('Points: connection'), datatype: 'uinteger', def: 1 },
	{ key: 'ban-points-kkdcp', type: 'int', tab: 'security', title: _('Points: KKDCP request'), datatype: 'uinteger', def: 1 },

	/* system */
	{ key: 'connect-script', type: 'str', tab: 'system', title: _('Connect script'),
	  desc: _('Called when a client connects and obtains an IP; parameters are passed in the environment') },
	{ key: 'disconnect-script', type: 'str', tab: 'system', title: _('Disconnect script') },
	{ key: 'use-utmp', type: 'flag', tab: 'system', title: _('Use utmp'), def: true },
	{ key: 'use-occtl', type: 'flag', tab: 'system', title: _('Enable occtl'), def: true,
	  desc: _('Support for the occtl tool; required by this application') },
	{ key: 'occtl-socket-file', type: 'str', tab: 'system', title: _('occtl socket file') },
	{ key: 'pid-file', type: 'str', tab: 'system', title: _('PID file') },
	{ key: 'chroot-dir', type: 'str', tab: 'system', title: _('Chroot directory') },
	{ key: 'socket-file', type: 'str', tab: 'system', title: _('IPC socket file'),
	  desc: _('Must be accessible within the chroot environment') },
	{ key: 'run-as-user', type: 'str', tab: 'system', title: _('Run as user') },
	{ key: 'run-as-group', type: 'str', tab: 'system', title: _('Run as group') },

	/* camouflage */
	{ key: 'camouflage', type: 'flag', tab: 'camouflage', title: _('Enable camouflage'), def: false,
	  desc: _('Make the server look like a web server to unauthorized parties; connecting requires the secret string in the URL') },
	{ key: 'camouflage_secret', type: 'str', quote: true, tab: 'camouflage', title: _('Camouflage secret'),
	  desc: _('Set on the client after "?", e.g. https://example.com/?mysecretkey') },
	{ key: 'camouflage_realm', type: 'str', quote: true, tab: 'camouflage', title: _('Camouflage realm'),
	  desc: _('Realm (browser prompt) for HTTP authentication; with no realm the server returns 404 instead of 401') },

	/* http headers */
	{ key: 'included-http-headers', type: 'list', tab: 'headers', title: _('Included HTTP headers'),
	  desc: _('HTTP headers sent in responses, one per line as "Name: value"') }
];

/* Options accepted in config-per-user / config-per-group files */
const PER_USER = [
	{ key: 'route', type: 'list', title: _('Routes'), desc: _('network/mask forwarded to the client') },
	{ key: 'no-route', type: 'list', title: _('Excluded routes'), desc: _('network/mask the client must not send through the VPN') },
	{ key: 'iroute', type: 'list', title: _('Internal routes (iroute)'), desc: _('Routes added on the server for this user or group') },
	{ key: 'dns', type: 'list', title: _('DNS servers'), datatype: 'ipaddr' },
	{ key: 'nbns', type: 'list', title: _('NBNS servers'), datatype: 'ipaddr' },
	{ key: 'split-dns', type: 'list', title: _('Split DNS domains') },
	{ key: 'ipv4-network', type: 'str', title: _('IPv4 network'), datatype: 'ip4addr' },
	{ key: 'ipv4-netmask', type: 'str', title: _('IPv4 netmask'), datatype: 'ip4addr' },
	{ key: 'ipv6-network', type: 'str', title: _('IPv6 network'), datatype: 'ip6addr' },
	{ key: 'ipv6-prefix', type: 'int', title: _('IPv6 prefix length'), datatype: 'range(1,128)' },
	{ key: 'explicit-ipv4', type: 'str', title: _('Fixed IPv4 address'), datatype: 'ip4addr' },
	{ key: 'explicit-ipv6', type: 'str', title: _('Fixed IPv6 address'), datatype: 'ip6addr' },
	{ key: 'rx-data-per-sec', type: 'int', title: _('Upload limit (bytes/s)'), datatype: 'uinteger' },
	{ key: 'tx-data-per-sec', type: 'int', title: _('Download limit (bytes/s)'), datatype: 'uinteger' },
	{ key: 'net-priority', type: 'int', title: _('Network priority'), datatype: 'uinteger' },
	{ key: 'cgroup', type: 'str', quote: true, title: _('Cgroup') },
	{ key: 'tunnel-all-dns', type: 'flag', title: _('Tunnel all DNS') },
	{ key: 'deny-roaming', type: 'flag', title: _('Deny roaming') },
	{ key: 'restrict-user-to-routes', type: 'flag', title: _('Restrict user to routes') },
	{ key: 'restrict-user-to-ports', type: 'list', title: _('Restrict user to ports'),
	  desc: _('Firewall rules such as "tcp(port=443)"') },
	{ key: 'keepalive', type: 'int', title: _('Keepalive (secs)'), datatype: 'uinteger' },
	{ key: 'dpd', type: 'int', title: _('Dead peer detection time (secs)'), datatype: 'uinteger' },
	{ key: 'mobile-dpd', type: 'int', title: _('Mobile dead peer detection (secs)'), datatype: 'uinteger' },
	{ key: 'idle-timeout', type: 'int', title: _('Idle timeout (secs)'), datatype: 'uinteger' },
	{ key: 'mobile-idle-timeout', type: 'int', title: _('Mobile idle timeout (secs)'), datatype: 'uinteger' },
	{ key: 'session-timeout', type: 'int', title: _('Session timeout (secs)'), datatype: 'uinteger' },
	{ key: 'stats-report-time', type: 'int', title: _('Statistics report time (secs)'), datatype: 'uinteger' },
	{ key: 'user-profile', type: 'str', title: _('Client profile XML') }
];

return baseclass.extend({
	TABS,
	GLOBAL_KEYS,
	scope,
	SERVER,
	PER_USER
});
