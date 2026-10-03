(() => {
	let requestId = 0;

	function setStatus(message, isError = false) {
		const status = document.getElementById('dictionary-status');
		status.textContent = message;
		status.classList.toggle('error', isError);
	}

	function addRelationGroup(container, title, terms, emptyMessage) {
		const section = document.createElement('section');
		section.className = 'dictionary-section';
		const heading = document.createElement('h3');
		heading.className = 'dictionary-section-title';
		heading.textContent = title;
		section.appendChild(heading);

		if (!terms.length) {
			const empty = document.createElement('p');
			empty.className = 'dictionary-empty';
			empty.textContent = emptyMessage;
			section.appendChild(empty);
		} else {
			const list = document.createElement('div');
			list.className = 'dictionary-terms';
			terms.forEach(term => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'dictionary-term';
				button.textContent = term;
				button.title = `Look up ${term}`;
				button.onclick = () => {
					document.getElementById('dictionary-query').value = term;
					searchDictionary(term);
				};
				list.appendChild(button);
			});
			section.appendChild(list);
		}
		container.appendChild(section);
	}

	function renderLookup(result) {
		const container = document.getElementById('dictionary-results');
		container.replaceChildren();
		const heading = document.createElement('h2');
		heading.className = 'dictionary-word';
		heading.textContent = result.word;
		container.appendChild(heading);
		const saveButton = document.createElement('button');
		saveButton.type = 'button';
		saveButton.className = 'dictionary-save-button';
		saveButton.textContent = window.DictionaryAPI.isSaved(result) ? 'Saved to Library' : 'Save to Library';
		saveButton.disabled = window.DictionaryAPI.isSaved(result);
		saveButton.onclick = () => {
			window.DictionaryAPI.saveToLibrary(result);
			saveButton.textContent = 'Saved to Library';
			saveButton.disabled = true;
			window.refreshLibraryUI?.();
		};
		container.appendChild(saveButton);

		if (!result.meanings.length) {
			setStatus(`No ${result.language} entry found for “${result.word}”.`);
			return;
		}

		setStatus(result.offline
			? 'Showing saved lookup · Wiktionary could not be reached.'
			: result.cached ? 'Showing saved lookup · reconnect to refresh from Wiktionary.'
				: `Found ${result.meanings.length} ${result.meanings.length === 1 ? 'definition' : 'definitions'} · ${result.language}.`);
		result.meanings.slice(0, 12).forEach(meaning => {
			const partOfSpeech = document.createElement('div');
			partOfSpeech.className = 'dictionary-pos';
			partOfSpeech.textContent = meaning.partOfSpeech;
			const definition = document.createElement('p');
			definition.className = 'dictionary-definition';
			definition.textContent = meaning.definition;
			container.append(partOfSpeech, definition);
			meaning.examples.slice(0, 2).forEach(exampleText => {
				const example = document.createElement('p');
				example.className = 'dictionary-example';
				example.textContent = exampleText;
				container.appendChild(example);
			});
		});

		const relations = result.relations || {};
		const relationUnavailable = result.relationsUnavailable ? 'Related-word data could not be loaded.' : null;
		addRelationGroup(container, 'Synonyms', relations.synonyms || [], relationUnavailable || 'No synonyms listed for this word.');
		addRelationGroup(container, 'Antonyms', relations.antonyms || [], relationUnavailable || 'No antonyms listed for this word.');
		addRelationGroup(container, 'Related terms', relations.related || [], relationUnavailable || 'No related terms listed for this word.');
		const source = document.createElement('a');
		source.className = 'dictionary-source-link';
		source.href = result.sourceUrl;
		source.textContent = 'View Wiktionary source · CC BY-SA';
		source.onclick = event => {
			event.preventDefault();
			if (window.aeonFiles) window.aeonFiles.openDictionarySource(result.sourceUrl);
			else window.open(result.sourceUrl, '_blank', 'noopener');
		};
		container.appendChild(source);
	}

	async function searchDictionary(query) {
		const word = (query || document.getElementById('dictionary-query').value).trim();
		const language = document.getElementById('dictionary-language').value;
		const currentRequest = ++requestId;
		if (!word) {
			setStatus('Enter a word to look up.');
			return;
		}

		document.getElementById('dictionary-query').value = word;
		document.getElementById('dictionary-results').replaceChildren();
		setStatus('Searching Wiktionary…');
		try {
			const result = await window.DictionaryAPI.lookup(word, language);
			if (currentRequest === requestId) renderLookup(result);
		} catch (error) {
			if (currentRequest !== requestId) return;
			setStatus(error.message || 'Dictionary lookup failed.', true);
			document.getElementById('dictionary-results').replaceChildren();
		}
	}

	function initializeDictionaryUI() {
		const languageSelect = document.getElementById('dictionary-language');
		const form = document.getElementById('dictionary-search-form');
		const savedLanguage = localStorage.getItem('aeonDictionaryLanguage') || 'en';
		window.DictionaryAPI.LANGUAGES.forEach(language => {
			const option = document.createElement('option');
			option.value = language.code;
			option.textContent = language.name;
			languageSelect.appendChild(option);
		});
		languageSelect.value = window.DictionaryAPI.LANGUAGES.some(language => language.code === savedLanguage) ? savedLanguage : 'en';
		languageSelect.addEventListener('change', () => {
			localStorage.setItem('aeonDictionaryLanguage', languageSelect.value);
			const query = document.getElementById('dictionary-query').value.trim();
			if (query) searchDictionary(query);
		});
		form.addEventListener('submit', event => {
			event.preventDefault();
			searchDictionary();
		});
	}

	window.searchDictionary = searchDictionary;
	window.initializeDictionaryUI = initializeDictionaryUI;
})();
