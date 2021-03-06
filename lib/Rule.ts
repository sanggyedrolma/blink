﻿var extend = require('node.extend');

import a = require('./helpers/array');
import Configuration = require('./Configuration');
import Formatter = require('./Formatter');
import IRuleBody = require('./interfaces/IRuleBody');
import s = require('./helpers/string');


class Rule {

	private config: Configuration;
	private decs: any[][];

	public get extenders() {
		return this.body.extend;
	}

	public get includes() {
		return this.body.include;
	}

	public selectors: string[];

	constructor(selectors: any, public body?: IRuleBody) {
		if (typeof selectors === 'string') {
			selectors = this.splitSelectors(selectors);
		}
		this.selectors = selectors.map(selector => {
			return selector.trim();
		});
	}

	private splitSelectors(selectors: string) {
		return selectors.split(/ *, */);
	}

	public resolve(config: Configuration): any[][] {
		this.config = config;
		var clone = this.clone();
		var body = clone.body;
		delete body.extend;
		delete body.include;

		var resolved = [];

		Object.keys(body).forEach(key => {
			if (key[0] === ':') {
				var selectors = this.joinSelectors(this.selectors, this.splitSelectors(key));
				var pseudoRule = new Rule(selectors, body[key]);
				delete body[key];
				[].push.apply(resolved, pseudoRule.resolve(this.config));
			}
		});

		var includes = this.resolveIncludes();
		var resolvedBody = extend(includes, this.resolveBody([], '', body));
		if (!resolvedBody || !resolvedBody.length) {
			return resolved;
		}

		resolved.unshift([this.selectors, resolvedBody]);
		return resolved;
	}

	private joinSelectors(left: string[], right: string[]) {
		var result = [];
		left.forEach(s1 => {
			right.forEach(s2 => {
				result.push(s1 + s2);
			});
		});
		return result;
	}

	public clone() {
		return new Rule(extend([], this.selectors), extend({}, this.body));
	}

	private resolveIncludes() {
		var includes = this.includes;
		if (!includes || !includes.length) {
			return [];
		}
		var result = [];
		includes.forEach(fn => {
			var decs = fn(this.config);
			if (!decs.length) {
				decs = decs(this.config);
			}
			[].push.apply(result, decs.map(dec => {
				return [dec[0], this.compileDeclarationValue(dec[1])];
			}));
		});
		return result;
	}

	private resolveBody(seed: any[][], key: string, body: any) {
		Object.keys(body).forEach(k2 => {
			var k1 = key || '';
			key = s.dasherize(this.combineKeys(k1, k2));
			var value = body[k2];
			if (this.isDeclarationValue(value)) {
				seed.push([key, this.compileDeclarationValue(value)]);
			} else {
				this.resolveBody(seed, key, value);
			}
			key = k1;
		});
		return seed;
	}

	private combineKeys(k1: string, k2: string) {
		if (k1 !== '' && k2[0] !== ':') {
			return k1 + '-' + k2;
		}
		return k1 + k2;
	}

	private isDeclarationValue(value: any) {
		if (value instanceof Array) {
			return true;
		}
		switch (typeof value) {
			case 'string':
			case 'number':
				return true;
		}
		return false;
	}

	private compileDeclarationValue(value: any) {
		if (value instanceof Array) {
			return this.compileArray(value);
		}
		return this.compilePrimitive(value);
	}

	private compileArray(arr: any[]) {
		return arr.map(primitive => {
			return this.compilePrimitive(primitive);
		}).join(' ');
	}

	private compilePrimitive(value: any) {
		switch (typeof value) {
			case 'string':
				if (~value.indexOf(' ')) {
					var quote = this.config.quote;
					return quote + value.replace(new RegExp(quote, 'g'), '\\' + quote) + quote;
				}
				return value;
			case 'number':
				return value ? value + 'px' : value;
			default:
				throw new Error('Unexpected type: ' + typeof value);
		}
	}

	public compile(config: Configuration) {
		return new Formatter().format(config, this.resolve(config));
	}

}

export = Rule;
