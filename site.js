(function () {
'use strict';

var NAV = [
	{ group: 'Start', pages: [
		['why', 'Why Bento'],
		['start', 'Getting started'],
	] },
	{ group: 'Language', pages: [
		['language', 'Language tour'],
		['uniformity', 'Uniformity'],
	] },
	{ group: 'Infrastructure', pages: [
		['toolchain', 'Tools'],
		['ir', 'IR and bytecode'],
		['ir-reference', 'IR reference'],
		['optimizer', 'Optimizer'],
		['targets', 'Targets'],
		['library', 'Library'],
	] },
	{ group: 'Project', pages: [
		['roadmap', 'Roadmap'],
		['bounty', 'Bug bounty'],
	] },
];

var TOP = [
	['index', 'Home'],
	['why', 'Why'],
	['language', 'Language'],
	['toolchain', 'Infrastructure'],
	['library', 'Library'],
	['roadmap', 'Roadmap'],
];

function escape(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeText(text) {
	return text.replace(/&(?![a-zA-Z]+;|#[0-9]+;|#x[0-9a-fA-F]+;)/g, '&amp;')
		.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rewrite(url) {
	return url.replace(/^([\w-]+)\.md(#.*)?$/, function (all, name, hash) {
		return name + '.html' + (hash || '');
	});
}

var BENTO_KEYWORDS = /^(fn|if|else|for|return|break|continue|discard|enum|struct|type|let|const|import|export|module|using|thread|simdgroup|workgroup|partgroup|quadgroup|dispatch|storage|constant|as|vector|matrix|image|texture|sampled|interface|context|with|requires)$/;
var BENTO_TYPES = /^(sampler|scene|r16|r32)$/;
var GLSL_KEYWORDS = /^(layout|in|out|inout|uniform|buffer|struct|return|if|else|for|while|do|break|continue|discard|const|readonly|writeonly|restrict|coherent|flat|smooth|noperspective|shared|precision|highp|mediump|lowp|true|false|std140|std430|binding|location|set|local_size_x|local_size_y|local_size_z)$/;
var GLSL_TYPES = /^(void|bool|int|uint|float|double|[biud]?vec[234]|mat[234](x[234])?|f16vec[234]|float16_t|u?int(8|16|64)_t|i?image[123]D|uimage[123]D|sampler[123]D)$/;
var C_KEYWORDS = /^(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|bool|true|false|NULL)$/;

function span(cls, text) {
	return cls ? '<span class="' + cls + '">' + escape(text) + '</span>' : escape(text);
}

function lex(text, rules, word) {
	var out = '';
	var i = 0;
	while (i < text.length) {
		var matched = false;
		for (var r = 0; r < rules.length; r++) {
			var rule = rules[r];
			rule[0].lastIndex = i;
			var m = rule[0].exec(text);
			if (m && m.index === i && m[0].length > 0) {
				var cls = typeof rule[1] === 'function' ? rule[1](m[0], text, i + m[0].length) : rule[1];
				out += span(cls, m[0]);
				i += m[0].length;
				matched = true;
				break;
			}
		}
		if (!matched) {
			out += escape(text[i]);
			i++;
		}
	}
	return out;
}

function callee(word, text, end) {
	return /^\s*\(/.test(text.slice(end, end + 8)) ? 'f' : '';
}

function bento(text) {
	var out = '';
	var depth = 0;
	var rules = [
		[/\/\/.*|\/\*[\s\S]*?\*\//y, 'c'],
		[/"(?:\\.|[^"\\\n])*"/y, 's'],
		[/@\(/y, 'a'],
		[/\.[A-Z]\w*/y, 't'],
		[/\b(?:0x[0-9a-fA-F_]+|[0-9][0-9_]*(?:\.[0-9][0-9_]*)?(?:[eE][+-]?[0-9]+)?)\b/y, 'n'],
		[/\b(?:true|false)\b/y, 'n'],
		[/\b[biuf](?:8|16|32|64)(?:x[1-4](?:x[1-4])?)?\b/y, 't'],
		[/\b[A-Za-z_]\w*\b/y, function (word, all, end) {
			if (depth > 0) return 'a';
			if (BENTO_KEYWORDS.test(word)) return 'k';
			if (BENTO_TYPES.test(word) || /^[A-Z][a-z0-9]\w*$/.test(word)) return 't';
			return callee(word, all, end);
		}],
		[/[()]/y, function (paren) {
			if (depth === 0) return '';
			depth += paren === '(' ? 1 : -1;
			return depth === 0 ? 'a' : '';
		}],
	];
	rules[2][1] = function () { depth = 1; return 'a'; };
	out = lex(text, rules);
	return out;
}

function glsl(text) {
	return lex(text, [
		[/\/\/.*|\/\*[\s\S]*?\*\//y, 'c'],
		[/^[ \t]*#.*$/my, 'k'],
		[/\b(?:0x[0-9a-fA-F]+|[0-9]+(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?)(?:u|lf|l|f|hf)?\b/y, 'n'],
		[/\bgl_\w+\b/y, 'a'],
		[/\b[A-Za-z_]\w*\b/y, function (word, all, end) {
			if (GLSL_KEYWORDS.test(word)) return 'k';
			if (GLSL_TYPES.test(word)) return 't';
			if (/^[A-Z][a-z0-9]\w*$/.test(word)) return 't';
			return callee(word, all, end);
		}],
	]);
}

function c(text) {
	return lex(text, [
		[/\/\/.*|\/\*[\s\S]*?\*\//y, 'c'],
		[/^[ \t]*#\s*\w+/my, 'k'],
		[/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])'/y, 's'],
		[/\b(?:0x[0-9a-fA-F]+|[0-9]+(?:\.[0-9]*)?)[uUlLfF]*\b/y, 'n'],
		[/\b[A-Za-z_]\w*\b/y, function (word, all, end) {
			if (C_KEYWORDS.test(word)) return 'k';
			if (/^(BTO[A-Z]\w*|u?int\d+_t|size_t|FILE)$/.test(word)) return 't';
			if (/^BTO_[A-Z0-9_]+$/.test(word)) return 'a';
			return callee(word, all, end);
		}],
	]);
}

function sh(text) {
	return text.split('\n').map(function (line) {
		return lex(line, [
			[/#.*/y, 'c'],
			[/"(?:\\.|[^"\\])*"|'[^']*'/y, 's'],
			[/(?:^|(?<=\|\s*))[\w./-]+/y, 'f'],
			[/\s--?[\w][\w=.,-]*/y, 'a'],
		]);
	}).join('\n');
}

function ir(text) {
	return lex(text, [
		[/;.*/y, 'c'],
		[/"(?:\\.|[^"\\\n])*"/y, 's'],
		[/@[\w:.]+/y, 'f'],
		[/%bb[0-9]+/y, 'a'],
		[/%r[0-9]+/y, ''],
		[/\$(?:-?0x[0-9a-fA-F.]+(?:p[+-]?[0-9]+)?|-?[0-9][0-9.]*(?:e[+-]?[0-9]+)?|[a-z]+)/y, 'n'],
		[/\b0x[0-9a-fA-F]+\b|\b[0-9]+\b/y, 'n'],
		[/\b[biuf](?:8|16|32|64)(?:x[1-4](?:x[1-4])?)?\b/y, 't'],
		[/\b[A-Z][A-Za-z0-9]*\b/y, 't'],
		[/\b[a-z_][a-z0-9_]*(?:\.[a-z]+)?\b/y, 'k'],
	]);
}

function spirv(text) {
	return lex(text, [
		[/;.*/y, 'c'],
		[/"(?:\\.|[^"\\])*"/y, 's'],
		[/%[\w.]+/y, 'n'],
		[/\bOp\w+\b/y, 'k'],
		[/\b[0-9]+\b/y, 'n'],
	]);
}

var HIGHLIGHT = { bento: bento, glsl: glsl, c: c, sh: sh, shell: sh, ir: ir, spirv: spirv };

function code(body, info) {
	var parts = info.split(/\s+/);
	var lang = parts.shift() || 'text';
	var caption = parts.join(' ');
	var highlight = HIGHLIGHT[lang];
	var inner = highlight ? highlight(body) : escape(body);
	var pre = '<pre class="lang-' + escape(lang) + '"><code>' + inner + '</code></pre>';
	return '<figure class="code">' + (caption ? '<figcaption>' + escape(caption) + '</figcaption>' : '') + pre + '</figure>\n';
}

function link(src, at) {
	var depth = 0;
	var i = at;
	for (; i < src.length; i++) {
		var ch = src[i];
		if (ch === '\\') { i++; continue; }
		if (ch === '`') {
			var close = src.indexOf('`', i + 1);
			if (close < 0) return null;
			i = close;
			continue;
		}
		if (ch === '[') depth++;
		if (ch === ']' && --depth === 0) break;
	}
	if (i >= src.length || src[i + 1] !== '(') return null;
	var m = /^\(\s*(<[^>]*>|[^\s)]+)(?:\s+"([^"]*)")?\s*\)/.exec(src.slice(i + 1));
	if (!m) return null;
	return { text: src.slice(at + 1, i), url: m[1].replace(/^<|>$/g, ''), title: m[2], end: i + 1 + m[0].length };
}

function inline(src) {
	var out = '';
	var i = 0;
	while (i < src.length) {
		var ch = src[i];
		var rest = src.slice(i);
		var m;
		if (ch === '\\' && /[\\`*_{}\[\]()#+\-.!|<>~:]/.test(src[i + 1] || '')) {
			out += escape(src[i + 1]);
			i += 2;
			continue;
		}
		if (ch === '`') {
			var n = /^`+/.exec(rest)[0].length;
			var fence = rest.slice(0, n);
			var end = src.indexOf(fence, i + n);
			while (end >= 0 && src[end + n] === '`') end = src.indexOf(fence, end + n + 1);
			if (end >= 0) {
				var text = src.slice(i + n, end).replace(/\n/g, ' ');
				if (/^ [\s\S]* $/.test(text) && text.trim()) text = text.slice(1, -1);
				out += '<code>' + escape(text) + '</code>';
				i = end + n;
				continue;
			}
			out += escape(fence);
			i += n;
			continue;
		}
		if (ch === '!' && src[i + 1] === '[' && (m = link(src, i + 1))) {
			out += '<img src="' + escape(m.url) + '" alt="' + escape(m.text) + '">';
			i = m.end;
			continue;
		}
		if (ch === '[' && (m = link(src, i))) {
			var href = rewrite(m.url);
			var external = /^https?:/.test(href);
			out += '<a href="' + escape(href) + '"' + (m.title ? ' title="' + escape(m.title) + '"' : '') + (external ? ' rel="noopener"' : '') + '>' + inline(m.text) + '</a>';
			i = m.end;
			continue;
		}
		if (ch === '<') {
			if ((m = /^<(https?:\/\/[^>\s]+)>/.exec(rest))) {
				out += '<a href="' + escape(m[1]) + '" rel="noopener">' + escape(m[1]) + '</a>';
				i += m[0].length;
				continue;
			}
			if ((m = /^<\/?[a-zA-Z][\w-]*(?:\s+[\w-]+(?:="[^"]*")?)*\s*\/?>/.exec(rest))) {
				out += m[0];
				i += m[0].length;
				continue;
			}
		}
		if (ch === '*' || ch === '_') {
			var before = i > 0 ? src[i - 1] : ' ';
			var word = ch === '_' && /\w/.test(before);
			if (!word) {
				var strong = ch === '*'
					? /^\*\*(?=\S)([\s\S]*?\S)\*\*/.exec(rest)
					: /^__(?=\S)([\s\S]*?\S)__(?!\w)/.exec(rest);
				if (strong) {
					out += '<strong>' + inline(strong[1]) + '</strong>';
					i += strong[0].length;
					continue;
				}
				var em = ch === '*'
					? /^\*(?=[^\s*])([\s\S]*?[^\s*])\*(?!\*)/.exec(rest)
					: /^_(?=\S)([\s\S]*?\S)_(?!\w)/.exec(rest);
				if (em) {
					out += '<em>' + inline(em[1]) + '</em>';
					i += em[0].length;
					continue;
				}
			}
		}
		if (ch === '&' && (m = /^&(?:[a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);/.exec(rest))) {
			out += m[0];
			i += m[0].length;
			continue;
		}
		out += escape(ch);
		i++;
	}
	return out;
}

function slug(text, ctx) {
	var base = text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '').toLowerCase()
		.replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
	var id = base;
	for (var n = 2; ctx.ids[id]; n++) id = base + '-' + n;
	ctx.ids[id] = true;
	return id;
}

function heading(level, text, ctx) {
	var html = inline(text);
	if (level === 1 && !ctx.title) ctx.title = html.replace(/<[^>]*>/g, '');
	var id = slug(html, ctx);
	if (level === 2) ctx.toc.push({ id: id, html: html });
	var anchor = level > 1
		? '<a class="anchor" href="#' + id + '" aria-hidden="true">' + new Array(level + 1).join('#') + '</a>'
		: '';
	return '<h' + level + ' id="' + id + '">' + anchor + html + '</h' + level + '>\n';
}

function cells(row) {
	row = row.trim().replace(/^\|/, '').replace(/\|$/, '');
	var out = [];
	var cell = '';
	var tick = false;
	for (var i = 0; i < row.length; i++) {
		var ch = row[i];
		if (ch === '\\' && row[i + 1] === '|') { cell += '|'; i++; continue; }
		if (ch === '`') tick = !tick;
		if (ch === '|' && !tick) { out.push(cell.trim()); cell = ''; continue; }
		cell += ch;
	}
	out.push(cell.trim());
	return out;
}

function table(lines, i) {
	var head = cells(lines[i]);
	var align = cells(lines[i + 1]).map(function (spec) {
		var left = spec[0] === ':';
		var right = spec[spec.length - 1] === ':';
		return left && right ? 'center' : right ? 'right' : '';
	});
	var cell = function (tag, text, k) {
		return '<' + tag + (align[k] ? ' style="text-align:' + align[k] + '"' : '') + '>' + inline(text) + '</' + tag + '>';
	};
	var html = '<div class="table"><table><thead><tr>' + head.map(function (text, k) { return cell('th', text, k); }).join('') + '</tr></thead><tbody>';
	i += 2;
	for (; i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i]); i++) {
		var row = cells(lines[i]);
		html += '<tr>' + head.map(function (unused, k) { return cell('td', row[k] || '', k); }).join('') + '</tr>';
	}
	return { html: html + '</tbody></table></div>\n', next: i };
}

var LIST = /^( *)([-*+]|[0-9]+[.)])( +|$)/;

function list(lines, i, ctx) {
	var first = LIST.exec(lines[i]);
	var base = first[1].length;
	var ordered = /[0-9]/.test(first[2]);
	var items = [];
	var current = null;
	var loose = false;
	var blank = false;
	for (; i < lines.length; i++) {
		var line = lines[i];
		var m = LIST.exec(line);
		if (m && m[1].length === base && /[0-9]/.test(m[2]) === ordered) {
			if (blank && current) loose = true;
			current = { lines: [line.slice(m[0].length)], indent: m[0].length };
			items.push(current);
			blank = false;
			continue;
		}
		if (/^\s*$/.test(line)) {
			blank = true;
			current.lines.push('');
			continue;
		}
		var indent = /^ */.exec(line)[0].length;
		if (indent > base) {
			current.lines.push(line.slice(Math.min(indent, current.indent)));
			blank = false;
			continue;
		}
		if (!blank && !LIST.exec(line) && !/^(#|```|~~~|:::|>)/.test(line)) {
			current.lines.push(line);
			continue;
		}
		break;
	}
	var html = items.map(function (item) {
		while (item.lines.length && /^\s*$/.test(item.lines[item.lines.length - 1])) item.lines.pop();
		var inner = blocks(item.lines, ctx, !loose);
		return '<li>' + inner.replace(/\n$/, '') + '</li>';
	}).join('\n');
	var start = ordered && parseInt(first[2], 10) !== 1 ? ' start="' + parseInt(first[2], 10) + '"' : '';
	return { html: (ordered ? '<ol' + start + '>' : '<ul>') + '\n' + html + '\n' + (ordered ? '</ol>' : '</ul>') + '\n', next: i };
}

function definitions(lines, i, ctx) {
	var html = '<dl>\n';
	while (i < lines.length && i + 1 < lines.length && /^:\s+/.test(lines[i + 1]) && !/^\s*$/.test(lines[i])) {
		html += '<dt>' + inline(lines[i]) + '</dt>\n';
		i++;
		while (i < lines.length && /^:\s+/.test(lines[i])) {
			var body = [lines[i].replace(/^:\s+/, '')];
			i++;
			while (i < lines.length && /^ {2,}\S/.test(lines[i])) body.push(lines[i++].trim());
			html += '<dd>' + blocks(body, ctx, true).replace(/\n$/, '') + '</dd>\n';
		}
		var look = i;
		while (look < lines.length && /^\s*$/.test(lines[look])) look++;
		if (look + 1 < lines.length && /^:\s+/.test(lines[look + 1])) i = look;
		else break;
	}
	return { html: html + '</dl>\n', next: i };
}

function container(kind, title, inner) {
	var head = title ? '<p class="title">' + inline(title) + '</p>' : '';
	return '<div class="' + escape(kind) + '">' + head + inner + '</div>\n';
}

var SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function blocks(lines, ctx, tight) {
	var html = '';
	var para = [];
	var flush = function () {
		if (!para.length) return;
		var text = inline(para.join('\n').trim());
		html += tight ? text + '\n' : '<p>' + text + '</p>\n';
		para = [];
	};
	var i = 0;
	while (i < lines.length) {
		var line = lines[i];
		var m;
		var result;
		if (/^\s*$/.test(line)) {
			flush();
			i++;
			continue;
		}
		if ((m = /^( *)(`{3,}|~{3,})\s*([^`]*)$/.exec(line))) {
			flush();
			var indent = m[1].length;
			var fence = new RegExp('^ *' + m[2][0] + '{' + m[2].length + ',}\\s*$');
			var body = [];
			for (i++; i < lines.length && !fence.test(lines[i]); i++) {
				var lead = /^ */.exec(lines[i])[0].length;
				body.push(lines[i].slice(Math.min(indent, lead)));
			}
			i++;
			html += code(body.join('\n'), m[3].trim());
			continue;
		}
		if ((m = /^:::\s*([\w-]+)\s*(.*)$/.exec(line))) {
			flush();
			var inner = [];
			var depth = 1;
			for (i++; i < lines.length; i++) {
				if (/^:::\s*[\w-]/.test(lines[i])) depth++;
				else if (/^:::\s*$/.test(lines[i]) && --depth === 0) break;
				inner.push(lines[i]);
			}
			i++;
			html += container(m[1], m[2], blocks(inner, ctx, false));
			continue;
		}
		if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) {
			flush();
			html += heading(m[1].length, m[2], ctx);
			i++;
			continue;
		}
		if (!para.length && /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			html += '<hr>\n';
			i++;
			continue;
		}
		if (/^ {0,3}>/.test(line)) {
			flush();
			var quote = [];
			for (; i < lines.length && /^ {0,3}>/.test(lines[i]); i++) quote.push(lines[i].replace(/^ {0,3}> ?/, ''));
			html += '<blockquote>\n' + blocks(quote, ctx, false) + '</blockquote>\n';
			continue;
		}
		if (/\|/.test(line) && i + 1 < lines.length && SEPARATOR.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
			flush();
			result = table(lines, i);
			html += result.html;
			i = result.next;
			continue;
		}
		if (LIST.test(line) && /\S/.test(line.replace(LIST, ''))) {
			flush();
			result = list(lines, i, ctx);
			html += result.html;
			i = result.next;
			continue;
		}
		if (!para.length && i + 1 < lines.length && /^:\s+/.test(lines[i + 1])) {
			result = definitions(lines, i, ctx);
			html += result.html;
			i = result.next;
			continue;
		}
		if (!para.length && /^<(div|figure|table|section|aside|details|ul|ol|pre|svg|p|img)\b/i.test(line)) {
			var raw = [];
			for (; i < lines.length && !/^\s*$/.test(lines[i]); i++) raw.push(lines[i]);
			html += raw.join('\n') + '\n';
			continue;
		}
		para.push(line);
		i++;
	}
	flush();
	return html;
}

function markdown(text) {
	var lines = text.replace(/\r\n?/g, '\n').split('\n');
	var lead = Infinity;
	lines.forEach(function (line) {
		if (/\S/.test(line)) lead = Math.min(lead, /^[ \t]*/.exec(line)[0].length);
	});
	if (lead !== Infinity && lead > 0) lines = lines.map(function (line) { return line.slice(lead); });
	var ctx = { toc: [], ids: {}, title: '' };
	var html = blocks(lines, ctx, false);
	return { html: html, toc: ctx.toc, title: ctx.title };
}

function current() {
	var name = location.pathname.split('/').pop().replace(/\.html$/, '');
	return name || 'index';
}

function header(page) {
	if (document.querySelector('header.site')) return;
	var links = TOP.map(function (entry) {
		var here = entry[0] === page || (entry[0] === 'language' && page === 'uniformity')
			|| (entry[0] === 'toolchain' && /^(ir|ir-reference|optimizer|targets)$/.test(page));
		return '<a href="' + entry[0] + '.html"' + (here ? ' aria-current="page"' : '') + '>' + entry[1] + '</a>';
	}).join('');
	var el = document.createElement('header');
	el.className = 'site';
	el.innerHTML = '<div class="wrap"><a class="brand" href="index.html"><span class="box"><span></span><span></span><span></span><span></span></span> Bento</a><nav>' + links + '</nav></div>';
	document.body.insertBefore(el, document.body.firstChild);
}

function banner() {
	var el = document.createElement('div');
	el.className = 'soon';
	el.textContent = 'Coming soon. The first release is planned for the end of November 2026.';
	document.body.insertBefore(el, document.body.firstChild);
}

function sidebar(page, toc) {
	return NAV.map(function (group) {
		var links = group.pages.map(function (entry) {
			var here = entry[0] === page;
			var sections = here && toc.length > 1 ? '<ul class="sections">' + toc.map(function (item) {
				return '<li><a href="#' + item.id + '">' + item.html + '</a></li>';
			}).join('') + '</ul>' : '';
			return '<li><a href="' + entry[0] + '.html"' + (here ? ' aria-current="page"' : '') + '>'
				+ entry[1] + '</a>' + sections + '</li>';
		}).join('');
		return '<p class="group">' + group.group + '</p><ul>' + links + '</ul>';
	}).join('');
}

function copyButtons(root) {
	Array.prototype.forEach.call(root.querySelectorAll('figure.code'), function (figure) {
		var pre = figure.querySelector('pre');
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'copy';
		button.textContent = 'Copy';
		button.addEventListener('click', function () {
			var done = function (label) {
				button.textContent = label;
				setTimeout(function () { button.textContent = 'Copy'; }, 1500);
			};
			if (navigator.clipboard) {
				navigator.clipboard.writeText(pre.textContent).then(function () { done('Copied'); }, function () { done('Select to copy'); });
			} else {
				done('Select to copy');
			}
		});
		figure.appendChild(button);
	});
}

function render() {
	var page = current();
	var source = document.querySelector('script[type="text/markdown"]');
	header(page);
	banner();
	if (source) {
		document.body.classList.add('docs');
		var doc = markdown(source.textContent);
		if (doc.title && !document.title) document.title = doc.title + ' · Bento';
		var main = document.createElement('main');
		main.className = 'doc';
		main.innerHTML = '<div class="wrap layout">'
			+ '<details class="side" open><summary>Contents</summary>' + sidebar(page, doc.toc) + '</details>'
			+ '<article class="prose">' + doc.html + '</article></div>';
		source.parentNode.insertBefore(main, source);
		if (window.matchMedia && window.matchMedia('(max-width: 60rem)').matches) {
			main.querySelector('details.side').removeAttribute('open');
		}
		copyButtons(main);
		if (location.hash) {
			var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
			if (target) target.scrollIntoView();
		}
	}
	Array.prototype.forEach.call(document.querySelectorAll('pre[data-lang]'), function (pre) {
		var highlight = HIGHLIGHT[pre.getAttribute('data-lang')];
		if (highlight) pre.innerHTML = highlight(pre.textContent);
	});
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = { markdown: markdown, highlight: HIGHLIGHT };
} else if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', render);
} else {
	render();
}
})();
