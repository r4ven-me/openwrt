#!/usr/bin/env python3
"""Generates the landing page of the apk repository: index.html with the package list and download links.

Usage: gen-index.py <dir with the *.apk files> <output index.html> [release] [arch]
Name and version come from the file names; the descriptions are in DESCRIPTIONS below.
The style follows the maintainer's sites (Nord theme, light and dark).
"""
import html
import os
import re
import sys

DESCRIPTIONS = {
    'luci-app-ocserv-r4ven-me': ('Веб-интерфейс LuCI для OpenConnect VPN (ocserv)', 'LuCI web interface for the OpenConnect VPN server (ocserv)'),
    'kmod-amneziawg-r4ven-me': ('Модуль ядра AmneziaWG (под ядро 6.12.112)', 'AmneziaWG kernel module (built for kernel 6.12.112)'),
    'amneziawg-tools-r4ven-me': ('Утилита awg и протокол netifd для AmneziaWG', 'The awg tool and the netifd protocol helper for AmneziaWG'),
    'luci-proto-amneziawg-r4ven-me': ('Поддержка протокола amneziawg в LuCI', 'amneziawg protocol support in LuCI'),
    'luci-app-amneziawg-r4ven-me': ('Веб-интерфейс LuCI: пиры, конфиги клиентов, маршрутизация', 'LuCI web interface: peers, client configs, routing'),
    'luci-i18n-amneziawg-ru-r4ven-me': ('Русский перевод интерфейса AmneziaWG', 'Russian translation of the AmneziaWG interface'),
    'luci-theme-kornord-r4ven-me': ('Тема Kornord для LuCI (цвета Nord)', 'Kornord theme for LuCI (Nord colors)'),
}
ORDER = list(DESCRIPTIONS)


import re as _re

SETUP = """wget -O /etc/apk/keys/r4ven-apk.pub https://apk.r4ven.me/r4ven-apk.pub
echo https://apk.r4ven.me/{release}/{arch}/packages.adb > /etc/apk/repositories.d/r4ven.list
apk update
apk add luci-app-ocserv-r4ven-me"""

_BUILTINS = {'echo', 'cd', 'export', 'source', 'exit', 'set', 'unset', 'read', 'test'}
_TOKEN = _re.compile(r"(&&|\|\||[|;<>])|(\"[^\"]*\"|'[^']*')|(#.*$)|(\S+)|(\s+)")


def highlight_bash(text):
    """Bash highlighting with the same token classes as Chroma (the maintainer's Hugo sites): the CSS variables
    --chroma-* below carry the Nord colors. Only what the Chroma bash lexer colors: builtins (nb), operators (o),
    strings (s), comments (c1); commands and arguments stay plain."""
    out_lines = []
    for line in text.split('\n'):
        out, first = [], True
        for m in _TOKEN.finditer(line):
            op, string, comment, word, space = m.groups()
            if op:
                out.append(f'<span class="o">{html.escape(op)}</span>')
                first = op in ('&&', '||', '|', ';')
            elif string:
                out.append(f'<span class="s">{html.escape(string)}</span>')
                first = False
            elif comment:
                out.append(f'<span class="c1">{html.escape(comment)}</span>')
            elif word:
                if first and word in _BUILTINS:
                    out.append(f'<span class="nb">{html.escape(word)}</span>')
                else:
                    out.append(html.escape(word))
                first = False
            else:
                out.append(space)
        out_lines.append('<span class="line">' + ''.join(out) + '</span>')
    return '\n'.join(out_lines)


def human(n):
    """Size as a two-language span: the unit depends on the page language."""
    units = (('Б', 'B'), ('КБ', 'KB'), ('МБ', 'MB'))
    k = 0
    while n >= 1024 and k < len(units) - 1:
        n /= 1024
        k += 1
    num = f'{n:.0f}' if k == 0 else f'{n:.1f}'
    return f'{num} <span data-ru>{units[k][0]}</span><span data-en>{units[k][1]}</span>'


def main():
    src, out = sys.argv[1], sys.argv[2]
    release = sys.argv[3] if len(sys.argv) > 3 else '25.12'
    arch = sys.argv[4] if len(sys.argv) > 4 else 'x86_64'
    pkgs = []
    for f in sorted(os.listdir(src)):
        m = re.match(r'^(.+?-r4ven-me)-(\d.*)\.apk$', f)
        if m:
            pkgs.append((m.group(1), m.group(2), f, os.path.getsize(os.path.join(src, f))))
    pkgs.sort(key=lambda p: (ORDER.index(p[0]) if p[0] in ORDER else 99, p[0]))

    rows = []
    for name, ver, fname, size in pkgs:
        ru, en = DESCRIPTIONS.get(name, ('', ''))
        rows.append(
            '<li class="pkg"><div class="pkg-main">'
            f'<a class="pkg-name" href="{release}/{arch}/{html.escape(fname)}">{html.escape(name)}</a>'
            f'<span class="pkg-desc"><span data-ru>{html.escape(ru)}</span><span data-en>{html.escape(en)}</span></span></div>'
            f'<span class="pkg-meta">{html.escape(ver)} · {human(size)}</span></li>'
        )

    code = highlight_bash(SETUP.format(release=release, arch=arch))
    page = TEMPLATE.replace('{{CODE}}', code).replace('{{PACKAGES}}', '\n'.join(rows)).replace('{{RELEASE}}', release).replace('{{ARCH}}', arch)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(page)
    print(f'{out}: {len(pkgs)} packages')


TEMPLATE = '''<!doctype html>
<html lang="ru" data-theme="nord" data-title-ru="Репозиторий apk для OpenWrt | Вороний блог" data-title-en="OpenWrt apk repository | Raven's blog">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Репозиторий apk для OpenWrt | Вороний блог</title>
<meta name="description" content="Signed apk repository for OpenWrt {{RELEASE}}: LuCI for ocserv, AmneziaWG, Kornord theme. / Подписанный apk-репозиторий для OpenWrt {{RELEASE}}.">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<script>
/* language and theme: saved choice, else the visitor's system settings; before the first paint */
(function () {
  var d = document.documentElement, s = null;
  try { s = window.localStorage; } catch (e) {}
  var get = function (k) { try { return s && s.getItem(k); } catch (e) { return null; } };
  var first = ((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
  d.lang = get('lang') || (first.indexOf('ru') === 0 ? 'ru' : 'en');
  d.setAttribute('data-mode', get('mode') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  document.title = d.getAttribute('data-title-' + d.lang);
})();
</script>
<style>
:root{--primary:oklch(0.594 0.077 254.027);--bg:oklch(0.951 0.007 260.731);--fg:oklch(0.324 0.022 264.182);--muted:oklch(0.933 0.01 261.788);--muted-fg:oklch(0.452 0.035 264.131);--border:oklch(0.899 0.016 262.749);--card:oklch(0.951 0.007 260.731);--chroma-bg:#eceff4;--chroma-text:#2e3440;--chroma-nb:#5e81ac;--chroma-o:#5e81ac;--chroma-s:#a3be8c;--chroma-c:#4c566a}
:root[data-mode=dark]{--primary:oklch(0.65 0.07 254.027);--bg:oklch(0.18 0.015 264.182);--fg:oklch(0.899 0.016 262.749);--muted:oklch(0.25 0.02 264.131);--muted-fg:oklch(0.70 0.035 264.131);--border:oklch(0.35 0.025 264.182);--card:oklch(0.22 0.018 264.182);--chroma-bg:#2e3440;--chroma-text:#d8dee9;--chroma-nb:#81a1c1;--chroma-o:#81a1c1;--chroma-s:#a3be8c;--chroma-c:#616e87}
@media (prefers-color-scheme:dark){:root:not([data-mode]){--primary:oklch(0.65 0.07 254.027);--bg:oklch(0.18 0.015 264.182);--fg:oklch(0.899 0.016 262.749);--muted:oklch(0.25 0.02 264.131);--muted-fg:oklch(0.70 0.035 264.131);--border:oklch(0.35 0.025 264.182);--card:oklch(0.22 0.018 264.182);--chroma-bg:#2e3440;--chroma-text:#d8dee9;--chroma-nb:#81a1c1;--chroma-o:#81a1c1;--chroma-s:#a3be8c;--chroma-c:#616e87}}
html[lang=en] [data-ru],html[lang=ru] [data-en]{display:none}
html[data-mode=dark] .i-sun,html:not([data-mode=dark]) .i-moon{display:none}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:56rem;margin:0 auto;padding:0 1rem}
header{padding:1.5rem 0}
.bar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1rem 1.5rem;border:1px solid var(--border);border-radius:.75rem;background:color-mix(in srgb,var(--card) 80%,transparent);box-shadow:0 1px 2px rgb(0 0 0/.05)}
.brand{display:flex;align-items:center;gap:.75rem;color:inherit;text-decoration:none;font-weight:600}
.brand img{width:2.5rem;height:2.5rem;border-radius:9999px;object-fit:cover}
.tools{display:flex;gap:.5rem}
.tool{display:inline-flex;align-items:center;justify-content:center;width:2.5rem;height:2.5rem;padding:0;border:1px solid var(--border);border-radius:.5rem;background:var(--card);color:var(--muted-fg);cursor:pointer;transition:border-color .2s ease-out,color .2s ease-out}
.tool:hover{border-color:var(--primary);color:var(--fg)}
.tool svg{width:1.25rem;height:1.25rem}
h1{font-size:1.75rem;margin:1.5rem 0 .25rem}
h2{font-size:1.125rem;margin:2rem 0 .75rem}
.lead{margin:0;color:var(--muted-fg)}
a{color:var(--primary)}
pre{margin:0;padding:1rem 1.25rem;overflow-x:auto;border:1px solid var(--border);border-radius:.75rem;background:var(--chroma-bg);color:var(--chroma-text);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.875rem;line-height:1.7}
pre code{font:inherit}
.chroma .nb{color:var(--chroma-nb)}.chroma .o{color:var(--chroma-o)}.chroma .s{color:var(--chroma-s)}.chroma .c1{color:var(--chroma-c)}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.75rem}
.pkg{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.25rem;border:1px solid var(--border);border-radius:.75rem;background:var(--card);transition:transform .2s ease-out,border-color .2s ease-out}
.pkg:hover{transform:translateY(-2px);border-color:var(--primary)}
.pkg-main{display:flex;flex-direction:column;min-width:0}
.pkg-name{font-weight:600;text-decoration:none;word-break:break-all}
.pkg-name:hover{text-decoration:underline}
.pkg-desc{font-size:.875rem;color:var(--muted-fg)}
.pkg-meta{flex-shrink:0;font-size:.8125rem;color:var(--muted-fg);text-align:right}
.note{margin-top:1.5rem;padding:1rem 1.25rem;border:1px solid var(--border);border-radius:.75rem;font-size:.9375rem;color:var(--muted-fg)}
.note b{color:var(--fg)}
footer{margin:2.5rem 0 2rem;font-size:.875rem;color:var(--muted-fg)}
@media (max-width:40rem){.pkg{flex-direction:column;align-items:flex-start;gap:.25rem}.pkg-meta{text-align:left}}
</style>
</head>
<body>
<div class="wrap">
<header><div class="bar">
<a class="brand" href="https://r4ven.me/"><img src="logo.jpg" alt=""><span data-ru>Вороний блог</span><span data-en>Raven's blog</span></a>
<div class="tools">
<button class="tool" id="lang-btn" type="button" aria-label="Language / Язык" title="Language / Язык">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
</button>
<button class="tool" id="theme-btn" type="button" aria-label="Theme / Тема" title="Theme / Тема">
<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
</button>
</div>
</div></header>
<main>
<h1><span data-ru>Репозиторий apk для OpenWrt</span><span data-en>OpenWrt apk repository</span></h1>
<p class="lead"><span data-ru>OpenWrt {{RELEASE}}, архитектура {{ARCH}}. Все пакеты подписаны ключом</span><span data-en>OpenWrt {{RELEASE}}, architecture {{ARCH}}. All packages are signed with the key</span> <a href="r4ven-apk.pub">r4ven-apk</a>.</p>

<h2><span data-ru>Подключение</span><span data-en>Setup</span></h2>
<pre class="chroma"><code class="language-bash" data-lang="bash">{{CODE}}</code></pre>

<h2><span data-ru>Пакеты</span><span data-en>Packages</span></h2>
<ul>
{{PACKAGES}}
</ul>

<div class="note"><b>AmneziaWG.</b>
<span data-ru>Модуль <code>kmod-amneziawg-r4ven-me</code> собран под ядро OpenWrt 25.12.6 x86/64 (6.12.112) и не загрузится на другом ядре. После установки перезагрузите роутер один раз.</span>
<span data-en>The <code>kmod-amneziawg-r4ven-me</code> module is built for the OpenWrt 25.12.6 x86/64 kernel (6.12.112) and will not load on another kernel. Reboot the router once after installing.</span></div>
</main>
<footer><span data-ru>Обновления приходят обычным</span><span data-en>Updates come with the usual</span> <code>apk update &amp;&amp; apk upgrade</code>. <a href="https://github.com/r4ven-me/openwrt"><span data-ru>Исходники</span><span data-en>Source</span></a></footer>
</div>
<script>
(function () {
  var d = document.documentElement;
  var save = function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} };
  document.getElementById('lang-btn').addEventListener('click', function () {
    d.lang = d.lang === 'ru' ? 'en' : 'ru';
    document.title = d.getAttribute('data-title-' + d.lang);
    save('lang', d.lang);
  });
  document.getElementById('theme-btn').addEventListener('click', function () {
    var m = d.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
    d.setAttribute('data-mode', m);
    save('mode', m);
  });
})();
</script>
</body>
</html>
'''

if __name__ == '__main__':
    main()
