(() => {
	const state = {
		allCards: [],
		cards: [],
		index: 0,
		isFlipped: false,
		levels: new Map(),
		deck: 'all',
		touchStartX: null,
	};

	const elements = {
		card: document.querySelector('#flashcard'),
		label: document.querySelector('#card-label'),
		content: document.querySelector('#card-content'),
		answerNote: document.querySelector('#answer-note'),
		hint: document.querySelector('#card-hint'),
		level: document.querySelector('#know-level'),
		levelLabel: document.querySelector('#know-level-label'),
		progressText: document.querySelector('#progress-text'),
		progressBar: document.querySelector('#progress-bar'),
		knownCount: document.querySelector('#known-count'),
		reviewCount: document.querySelector('#review-count'),
		deckSelect: document.querySelector('#deck-select'),
		shuffle: document.querySelector('#shuffle-btn'),
		reset: document.querySelector('#reset-btn'),
		addDeck: document.querySelector('#add-deck-btn'),
		previous: document.querySelector('#previous-btn'),
		flip: document.querySelector('#flip-btn'),
		next: document.querySelector('#next-btn'),
		form: document.querySelector('#card-form'),
		questionInput: document.querySelector('#question-input'),
		answerInput: document.querySelector('#answer-input'),
		questionHintInput: document.querySelector('#question-hint-input'),
		answerNoteInput: document.querySelector('#answer-note-input'),
	};

	const storageKeys = { cards: 'flashcard-cards', levels: 'flashcard-levels' };
	const levelLabels = ["Don't know", 'Learning', 'Know'];

	function readStorage(key, fallback) {
		try {
			const value = JSON.parse(localStorage.getItem(key));
			return value ?? fallback;
		} catch {
			return fallback;
		}
	}

	function saveStorage() {
		localStorage.setItem(storageKeys.cards, JSON.stringify(state.allCards));
		localStorage.setItem(storageKeys.levels, JSON.stringify(Object.fromEntries(state.levels)));
	}

	function cardKey(card, index) {
		return card.id ?? `${card.question ?? card.front ?? card.term ?? ''}:${card.answer ?? card.back ?? card.definition ?? ''}:${index}`;
	}

	function getCardText(card) {
		return {
			question: card.question ?? card.front ?? card.term ?? '',
			answer: card.answer ?? card.back ?? card.definition ?? '',
		};
	}

	function markdownToHtml(markdown) {
		const escaped = String(markdown ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
		return escaped
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/__([^_]+)__/g, '<strong>$1</strong>')
			.replace(/\*([^*]+)\*/g, '<em>$1</em>')
			.replace(/_([^_]+)_/g, '<em>$1</em>')
			.replace(/\n/g, '<br>');
	}

	function getLevel(card) {
		return state.levels.get(cardKey(card, state.allCards.indexOf(card))) ?? (Number(card.know_level) || 0);
	}

	function updateDeckOptions() {
		if (!elements.deckSelect) return;
		const decks = [...new Set(state.allCards.map((card) => card.deck).filter(Boolean))];
		elements.deckSelect.replaceChildren(new Option('All cards', 'all'));
		decks.forEach((deck) => elements.deckSelect.append(new Option(deck, deck)));
		elements.deckSelect.value = decks.includes(state.deck) ? state.deck : 'all';
	}

	async function loadCards() {
		try {
			const response = await fetch('cards.js');
			if (!response.ok) throw new Error(`Unable to load cards: ${response.status}`);
			const source = await response.text();
			const match = source.match(/(?:const|let|var)\s+cards\s*=\s*(\[[\s\S]*?\])\s*;?/);
			const seedCards = match ? Function(`"use strict"; return (${match[1]})`)() : [];
			const savedCards = readStorage(storageKeys.cards, null);
			state.allCards = Array.isArray(savedCards) ? savedCards : seedCards;
			const savedLevels = readStorage(storageKeys.levels, {});
			state.levels = new Map(Object.entries(savedLevels).map(([key, value]) => [key, Math.max(0, Math.min(2, Number(value) || 0))]));
			updateDeckOptions();
			applyDeck();
			render();
		} catch (error) {
			console.error(error);
			if (elements.content) elements.content.textContent = 'Could not load cards.';
		}
	}

	function render() {
		const card = state.cards[state.index];
		const total = state.cards.length;
		const reviewed = state.cards.filter((item) => getLevel(item) > 0).length;
		const known = state.cards.filter((item) => getLevel(item) === 2).length;
		if (elements.progressText) elements.progressText.textContent = `${reviewed} of ${total} cards reviewed`;
		if (elements.progressBar) elements.progressBar.style.width = `${total ? (reviewed / total) * 100 : 0}%`;
		if (elements.knownCount) elements.knownCount.textContent = known;
		if (elements.reviewCount) elements.reviewCount.textContent = total - known;
		if (!card) {
			elements.label.textContent = 'No cards';
			elements.content.textContent = 'Add a flashcard to begin.';
			elements.hint.textContent = '';
			return;
		}
		const { question, answer } = getCardText(card);
		const level = getLevel(card);
		elements.label.textContent = state.isFlipped ? 'Answer' : (card.question_hint || 'Question');
		elements.content.textContent = state.isFlipped ? answer : question;
		elements.answerNote.innerHTML = state.isFlipped && card.answer_note ? markdownToHtml(card.answer_note) : '';
		elements.answerNote.hidden = !state.isFlipped || !card.answer_note;
		elements.hint.textContent = state.isFlipped ? 'Click the card to show the question' : 'Click the card to reveal the answer';
		elements.level.value = level;
		elements.levelLabel.textContent = levelLabels[level];
		elements.level.setAttribute('aria-valuetext', levelLabels[level]);
		elements.card.classList.toggle('is-flipped', state.isFlipped);
		elements.card.setAttribute('aria-label', `${state.isFlipped ? 'Answer' : 'Question'}: ${state.isFlipped ? answer : question}`);
	}

	function goTo(index) {
		if (!state.cards.length) return;
		state.index = (index + state.cards.length) % state.cards.length;
		state.isFlipped = false;
		render();
	}

	function applyDeck() {
		state.cards = state.deck === 'all' ? [...state.allCards] : state.allCards.filter((card) => card.deck === state.deck);
		state.index = 0;
		state.isFlipped = false;
	}

	function shuffle() {
		for (let i = state.cards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[state.cards[i], state.cards[j]] = [state.cards[j], state.cards[i]];
		}
		state.index = 0;
		state.isFlipped = false;
		render();
	}

	function flip() {
		if (!state.cards.length) return;
		state.isFlipped = !state.isFlipped;
		render();
	}

	elements.flip?.addEventListener('click', flip);
	elements.card?.addEventListener('click', flip);
	elements.next?.addEventListener('click', () => goTo(state.index + 1));
	elements.previous?.addEventListener('click', () => goTo(state.index - 1));
	elements.shuffle?.addEventListener('click', shuffle);
	elements.reset?.addEventListener('click', () => {
		state.levels.clear();
		saveStorage();
		render();
	});
	elements.level?.addEventListener('input', (event) => {
		if (!state.cards.length) return;
		const card = state.cards[state.index];
		state.levels.set(cardKey(card, state.allCards.indexOf(card)), Number(event.target.value));
		saveStorage();
		render();
	});
	elements.level?.addEventListener('click', (event) => event.stopPropagation());
	elements.deckSelect?.addEventListener('change', (event) => {
		state.deck = event.target.value;
		applyDeck();
		render();
	});
	elements.addDeck?.addEventListener('click', () => {
		const deck = window.prompt('Name your new deck:');
		if (!deck?.trim()) return;
		state.deck = deck.trim();
		updateDeckOptions();
		elements.deckSelect.value = state.deck;
		applyDeck();
		render();
	});
	elements.form?.addEventListener('submit', (event) => {
		event.preventDefault();
		const question = elements.questionInput.value.trim();
		const answer = elements.answerInput.value.trim();
		if (!question || !answer) return;
		const card = {
			id: `custom-${Date.now()}`,
			question,
			answer,
			question_hint: elements.questionHintInput.value.trim(),
			answer_note: elements.answerNoteInput.value.trim(),
			know_level: 0,
			deck: state.deck === 'all' ? 'My cards' : state.deck,
		};
		state.allCards.push(card);
		state.deck = card.deck;
		updateDeckOptions();
		elements.deckSelect.value = state.deck;
		applyDeck();
		saveStorage();
		elements.form.reset();
		render();
	});

	document.addEventListener('keydown', (event) => {
		if (event.target.matches('input, select, textarea')) return;
		if (event.key === 'ArrowRight') goTo(state.index + 1);
		if (event.key === 'ArrowLeft') goTo(state.index - 1);
		if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); flip(); }
	});
	elements.card?.addEventListener('touchstart', (event) => { state.touchStartX = event.changedTouches[0].clientX; }, { passive: true });
	elements.card?.addEventListener('touchend', (event) => {
		if (state.touchStartX === null) return;
		const distance = event.changedTouches[0].clientX - state.touchStartX;
		state.touchStartX = null;
		if (Math.abs(distance) > 50) goTo(state.index + (distance < 0 ? 1 : -1));
	});

	loadCards();
})();
