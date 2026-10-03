(() => {
	const FRENCH_VERBS = [
		{ infinitive: 'être', meaning: 'to be', forms: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'] },
		{ infinitive: 'avoir', meaning: 'to have', forms: ['ai', 'as', 'a', 'avons', 'avez', 'ont'] },
		{ infinitive: 'aller', meaning: 'to go', forms: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'] },
		{ infinitive: 'faire', meaning: 'to do; to make', forms: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'] },
		{ infinitive: 'parler', meaning: 'to speak', forms: ['parle', 'parles', 'parle', 'parlons', 'parlez', 'parlent'] },
		{ infinitive: 'finir', meaning: 'to finish', forms: ['finis', 'finis', 'finit', 'finissons', 'finissez', 'finissent'] },
		{ infinitive: 'prendre', meaning: 'to take', forms: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'] },
		{ infinitive: 'venir', meaning: 'to come', forms: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'] },
		{ infinitive: 'pouvoir', meaning: 'to be able to', forms: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'] },
		{ infinitive: 'vouloir', meaning: 'to want', forms: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'] }
	];
	const FRENCH_PRONOUNS = ['je', 'tu', 'il / elle / on', 'nous', 'vous', 'ils / elles'];
	let activeSection = 'dictionary';

	function appendText(parent, tagName, className, text) {
		const element = document.createElement(tagName);
		element.className = className;
		element.textContent = text;
		parent.appendChild(element);
		return element;
	}

	function currentFilter() {
		return {
			language: document.getElementById('library-language').value,
			query: document.getElementById('library-search').value.trim().toLocaleLowerCase()
		};
	}

	function matchesFilter(entry, filter) {
		if (filter.language !== 'all' && entry.languageCode !== filter.language) return false;
		if (!filter.query) return true;
		return JSON.stringify(entry).toLocaleLowerCase().includes(filter.query);
	}

	function renderSavedEntries(container, section) {
		const filter = currentFilter();
		const entries = window.DictionaryAPI.getLibraryEntries().filter(entry => {
			if (!matchesFilter(entry, filter)) return false;
			if (section !== 'thesaurus') return true;
			const relations = entry.relations || {};
			return ['synonyms', 'antonyms', 'related'].some(group => (relations[group] || []).length);
		});

		const totalEntries = window.DictionaryAPI.getLibraryEntries().length;
		if (!entries.length) {
			const message = totalEntries === 0
				? 'Your saved reference collection is empty.'
				: section === 'thesaurus'
					? 'No saved entries have related words for this language or search.'
					: 'No saved entries match this language or search.';
			appendText(container, 'p', 'library-empty', message);
			return;
		}

		entries.forEach(entry => {
			const card = document.createElement('article');
			card.className = 'library-entry';
			const header = document.createElement('div');
			header.className = 'library-entry-header';
			const wordBlock = document.createElement('div');
			appendText(wordBlock, 'h3', 'library-entry-word', entry.word);
			appendText(wordBlock, 'div', 'library-entry-language', entry.language || entry.languageCode);
			header.appendChild(wordBlock);
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'library-remove';
			remove.textContent = 'Remove';
			remove.setAttribute('aria-label', `Remove ${entry.word} from library`);
			remove.onclick = () => {
				window.DictionaryAPI.removeFromLibrary(entry.word, entry.languageCode);
				renderLibrary();
			};
			header.appendChild(remove);
			container.appendChild(header);

			if (section === 'dictionary') {
				(entry.meanings || []).slice(0, 6).forEach(meaning => {
					if (meaning.partOfSpeech) appendText(container, 'div', 'library-entry-pos', meaning.partOfSpeech);
					appendText(container, 'p', 'library-entry-definition', meaning.definition);
					(meaning.examples || []).slice(0, 1).forEach(example => appendText(container, 'p', 'dictionary-example', example));
				});
			} else {
				const relations = entry.relations || {};
				[
					['Synonyms', 'synonyms'],
					['Antonyms', 'antonyms'],
					['Related terms', 'related']
				].forEach(([label, key]) => {
					if ((relations[key] || []).length) appendText(container, 'p', 'library-entry-relations', `${label}: ${relations[key].join(', ')}`);
				});
			}

			if (entry.sourceUrl) {
				const source = document.createElement('a');
				source.className = 'dictionary-source-link';
				source.href = entry.sourceUrl;
				source.textContent = 'Wiktionary · CC BY-SA';
				source.onclick = event => {
					event.preventDefault();
					if (window.aeonFiles) window.aeonFiles.openDictionarySource(entry.sourceUrl);
					else window.open(entry.sourceUrl, '_blank', 'noopener');
				};
				container.appendChild(source);
			}
		});
	}

	function renderFrenchVerbs(container) {
		const selector = document.createElement('select');
		selector.className = 'dictionary-select library-verb-select';
		selector.setAttribute('aria-label', 'French verb');
		FRENCH_VERBS.forEach(verb => {
			const option = document.createElement('option');
			option.value = verb.infinitive;
			option.textContent = verb.infinitive;
			selector.appendChild(option);
		});
		container.appendChild(selector);

		const title = appendText(container, 'h2', 'library-verb-title', '');
		const meaning = appendText(container, 'p', 'library-verb-meaning', '');
		const table = document.createElement('table');
		table.className = 'library-verb-table';
		container.appendChild(table);

		function showVerb() {
			const verb = FRENCH_VERBS.find(item => item.infinitive === selector.value);
			title.textContent = verb.infinitive;
			meaning.textContent = `${verb.meaning} · Indicatif présent`;
			table.replaceChildren();
			const head = document.createElement('thead');
			const headRow = document.createElement('tr');
			appendText(headRow, 'th', '', 'Pronoun');
			appendText(headRow, 'th', '', 'Form');
			head.appendChild(headRow);
			const body = document.createElement('tbody');
			FRENCH_PRONOUNS.forEach((pronoun, index) => {
				const row = document.createElement('tr');
				appendText(row, 'td', '', pronoun);
				appendText(row, 'td', '', verb.forms[index]);
				body.appendChild(row);
			});
			table.append(head, body);
		}
		selector.addEventListener('change', showVerb);
		showVerb();
	}

	function renderLibrary() {
		const results = document.getElementById('library-results');
		const filters = document.getElementById('library-filters');
		const status = document.getElementById('library-status');
		results.replaceChildren();
		filters.hidden = activeSection === 'french-verbs';
		if (activeSection === 'french-verbs') {
			status.textContent = 'Offline reference · Indicatif présent';
			renderFrenchVerbs(results);
			return;
		}
		const entries = window.DictionaryAPI.getLibraryEntries();
		const visibleCount = entries.filter(entry => matchesFilter(entry, currentFilter()) &&
			(activeSection !== 'thesaurus' || ['synonyms', 'antonyms', 'related'].some(group => (entry.relations?.[group] || []).length))
		).length;
		status.textContent = `${visibleCount} saved ${visibleCount === 1 ? 'entry' : 'entries'} · Available offline`;
		renderSavedEntries(results, activeSection);
	}

	function selectLibrarySection(section) {
		if (!['dictionary', 'thesaurus', 'french-verbs'].includes(section)) section = 'dictionary';
		activeSection = section;
		document.querySelectorAll('.library-tab').forEach(tab => {
			const active = tab.dataset.librarySection === section;
			tab.classList.toggle('active', active);
			tab.setAttribute('aria-selected', String(active));
		});
		localStorage.setItem('aeonLibrarySection', section);
		renderLibrary();
	}

	function openLibrary(section = localStorage.getItem('aeonLibrarySection') || 'dictionary') {
		const dictionaryPanel = document.getElementById('dictionary-panel');
		dictionaryPanel.classList.remove('open');
		dictionaryPanel.setAttribute('aria-hidden', 'true');
		const dictionaryButton = document.getElementById('btn-dictionary');
		dictionaryButton.classList.remove('active');
		dictionaryButton.setAttribute('aria-expanded', 'false');
		const panel = document.getElementById('library-panel');
		panel.classList.add('open');
		panel.setAttribute('aria-hidden', 'false');
		selectLibrarySection(section);
		if (section !== 'french-verbs') document.getElementById('library-search').focus();
	}

	function closeLibrary() {
		const panel = document.getElementById('library-panel');
		panel.classList.remove('open');
		panel.setAttribute('aria-hidden', 'true');
		document.getElementById('editor').focus();
	}

	function initializeLibraryUI() {
		const languageSelect = document.getElementById('library-language');
		const allLanguages = document.createElement('option');
		allLanguages.value = 'all';
		allLanguages.textContent = 'All languages';
		languageSelect.appendChild(allLanguages);
		window.DictionaryAPI.LANGUAGES.forEach(language => {
			const option = document.createElement('option');
			option.value = language.code;
			option.textContent = language.name;
			languageSelect.appendChild(option);
		});
		languageSelect.value = 'all';
		languageSelect.addEventListener('change', renderLibrary);
		document.getElementById('library-search').addEventListener('input', renderLibrary);
		selectLibrarySection(localStorage.getItem('aeonLibrarySection') || 'dictionary');
	}

	window.openLibrary = openLibrary;
	window.closeLibrary = closeLibrary;
	window.selectLibrarySection = selectLibrarySection;
	window.initializeLibraryUI = initializeLibraryUI;
	window.refreshLibraryUI = renderLibrary;
})();
