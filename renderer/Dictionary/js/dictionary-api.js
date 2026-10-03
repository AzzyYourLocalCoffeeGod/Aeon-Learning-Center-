(() => {
	const API_ROOT = 'https://en.wiktionary.org';
	const CACHE_KEY = 'aeonDictionaryCache';
	const LIBRARY_KEY = 'aeonLanguageLibrary';
	const CACHE_LIMIT = 80;
	const LIBRARY_LIMIT = 500;
	const CACHE_AGE = 30 * 24 * 60 * 60 * 1000;
	const LANGUAGES = [
		{ code: 'en', name: 'English', section: 'English' },
		{ code: 'es', name: 'Spanish', section: 'Spanish' },
		{ code: 'fr', name: 'French', section: 'French' },
		{ code: 'de', name: 'German', section: 'German' },
		{ code: 'pt', name: 'Portuguese', section: 'Portuguese' },
		{ code: 'it', name: 'Italian', section: 'Italian' }
	];

	function cacheRead() {
		try {
			return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
		} catch {
			return {};
		}
	}

	function cacheWrite(cache) {
		try {
			localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
		} catch {
			// Lookups remain usable if local storage is full or unavailable.
		}
	}

	function readLibrary() {
		try {
			const entries = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
			return Array.isArray(entries) ? entries : [];
		} catch {
			return [];
		}
	}

	function getLibraryEntries() {
		return readLibrary().sort((left, right) => right.savedAt - left.savedAt);
	}

	function saveToLibrary(result) {
		if (!result || !LANGUAGES.some(language => language.code === result.languageCode) || !result.word) {
			throw new Error('This lookup cannot be saved to the Library.');
		}
		const entries = readLibrary().filter(entry =>
			!(entry.languageCode === result.languageCode && entry.word.toLocaleLowerCase() === result.word.toLocaleLowerCase())
		);
		entries.unshift({ ...result, savedAt: Date.now() });
		localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries.slice(0, LIBRARY_LIMIT)));
		return getLibraryEntries();
	}

	function removeFromLibrary(word, languageCode) {
		const entries = readLibrary().filter(entry =>
			!(entry.languageCode === languageCode && entry.word.toLocaleLowerCase() === word.toLocaleLowerCase())
		);
		localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
		return getLibraryEntries();
	}

	function isSaved(result) {
		return readLibrary().some(entry =>
			entry.languageCode === result.languageCode && entry.word.toLocaleLowerCase() === result.word.toLocaleLowerCase()
		);
	}

	function plainText(markup) {
		const parsed = new DOMParser().parseFromString(markup || '', 'text/html');
		return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
	}

	async function requestJson(url) {
		const response = await fetch(url, { headers: { Accept: 'application/json' } });
		let data;
		try {
			data = await response.json();
		} catch {
			throw new Error('The dictionary service returned an unreadable response.');
		}
		if (!response.ok) {
			if (response.status === 404) throw new Error('No entry found for that word.');
			throw new Error(`Dictionary service error (${response.status}).`);
		}
		return data;
	}

	async function fetchRelations(word, language) {
		const params = new URLSearchParams({
			action: 'parse',
			page: word,
			prop: 'sections',
			format: 'json',
			origin: '*'
		});
		const parsed = await requestJson(`${API_ROOT}/w/api.php?${params}`);
		const sections = parsed.parse?.sections || [];
		const languageIndex = sections.findIndex(section =>
			section.level === '2' && section.line.toLowerCase() === language.section.toLowerCase()
		);
		if (languageIndex < 0) return { synonyms: [], antonyms: [], related: [] };

		const nextLanguageIndex = sections.findIndex((section, index) =>
			index > languageIndex && section.level === '2'
		);
		const languageSections = sections.slice(languageIndex + 1, nextLanguageIndex < 0 ? undefined : nextLanguageIndex);
		const relationSections = languageSections.filter(section =>
			/^(synonyms?|antonyms?)$/i.test(section.line) || /^(related terms|derived terms|coordinate terms)$/i.test(section.line)
		);
		const groups = { synonyms: [], antonyms: [], related: [] };

		await Promise.all(relationSections.map(async section => {
			const params = new URLSearchParams({
				action: 'parse',
				page: word,
				prop: 'links',
				section: section.index,
				format: 'json',
				origin: '*'
			});
			const data = await requestJson(`${API_ROOT}/w/api.php?${params}`);
			const terms = (data.parse?.links || [])
				.map(link => link['*'] || link.title || '')
				.filter(Boolean);
			const key = /^synonyms?$/i.test(section.line)
				? 'synonyms'
				: /^antonyms?$/i.test(section.line) ? 'antonyms' : 'related';
			groups[key].push(...terms);
		}));

		Object.keys(groups).forEach(key => {
			groups[key] = [...new Map(groups[key].map(term => [term.toLocaleLowerCase(), term])).values()]
				.filter(term => term.toLocaleLowerCase() !== word.toLocaleLowerCase())
				.slice(0, 12);
		});
		return groups;
	}

	async function lookup(word, languageCode) {
		const normalizedWord = word.trim().replace(/\s+/g, ' ');
		const language = LANGUAGES.find(item => item.code === languageCode);
		if (!language) throw new Error('Choose a supported language.');
		if (!normalizedWord) throw new Error('Enter a word to look up.');
		if (normalizedWord.length > 80) throw new Error('Lookups are limited to 80 characters.');

		const key = `${language.code}:${normalizedWord.toLocaleLowerCase()}`;
		const cache = cacheRead();
		const cached = cache[key];
		if (cached && Date.now() - cached.savedAt < CACHE_AGE) {
			return { ...cached.result, cached: true };
		}

		const definitionUrl = `${API_ROOT}/api/rest_v1/page/definition/${encodeURIComponent(normalizedWord.replace(/ /g, '_'))}`;
		let payload;
		try {
			payload = await requestJson(definitionUrl);
		} catch (error) {
			if (cached) return { ...cached.result, cached: true, offline: true };
			throw error;
		}
		const entries = payload[language.code] || [];
		const meanings = entries.flatMap(entry => (entry.definitions || []).map(definition => ({
			partOfSpeech: entry.partOfSpeech || '',
			definition: plainText(definition.definition),
			examples: (definition.parsedExamples || []).map(example => plainText(example.example)).filter(Boolean)
		}))).filter(item => item.definition);

		const result = {
			word: normalizedWord,
			language: language.name,
			languageCode: language.code,
			meanings,
			relations: { synonyms: [], antonyms: [], related: [] },
			sourceUrl: `${API_ROOT}/wiki/${encodeURIComponent(normalizedWord.replace(/ /g, '_'))}`,
			cached: false
		};

		if (meanings.length) {
			try {
				result.relations = await fetchRelations(normalizedWord.replace(/ /g, '_'), language);
			} catch {
				result.relationsUnavailable = true;
			}
		}

		if (Object.keys(cache).length >= CACHE_LIMIT) {
			const oldest = Object.entries(cache).sort((left, right) => left[1].savedAt - right[1].savedAt)[0];
			if (oldest) delete cache[oldest[0]];
		}
		cache[key] = { savedAt: Date.now(), result };
		cacheWrite(cache);
		return result;
	}

	window.DictionaryAPI = Object.freeze({ LANGUAGES, lookup, getLibraryEntries, saveToLibrary, removeFromLibrary, isSaved });
})();
