(() => {
	const state = {
		allCards: [],
		cards: [],
		index: 0,
		isFlipped: false,
		known: new Set(),
		deck: 'all',
		touchStartX: null,
	};

	const elements = {
		card: document.querySelector('#flashcard'),
		label: document.querySelector('#card-label'),
		content: document.querySelector('#card-content'),
		hint: document.querySelector('#card-hint'),
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
	};

	const storageKeys = { cards: 'flashcard-cards', known: 'flashcard-known' };

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
		localStorage.setItem(storageKeys.known, JSON.stringify([...state.known]));
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
			state.known = new Set(readStorage(storageKeys.known, []));
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
		const reviewed = state.cards.filter((item, index) => state.known.has(cardKey(item, state.allCards.indexOf(item)))).length;
		if (elements.progressText) elements.progressText.textContent = `${reviewed} of ${total} cards reviewed`;
		if (elements.progressBar) elements.progressBar.style.width = `${total ? (reviewed / total) * 100 : 0}%`;
		if (elements.knownCount) elements.knownCount.textContent = reviewed;
		if (elements.reviewCount) elements.reviewCount.textContent = total - reviewed;
		if (!card) {
			elements.label.textContent = 'No cards';
			elements.content.textContent = 'Add a flashcard to begin.';
			elements.hint.textContent = '';
			return;
		}
		const { question, answer } = getCardText(card);
		elements.label.textContent = state.isFlipped ? 'Answer' : 'Question';
		elements.content.textContent = state.isFlipped ? answer : question;
		elements.hint.textContent = state.isFlipped ? 'Click the card to show the question' : 'Click the card to reveal the answer';
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
		if (!state.isFlipped) {
			state.known.add(cardKey(state.cards[state.index], state.allCards.indexOf(state.cards[state.index])));
			saveStorage();
		}
		state.isFlipped = !state.isFlipped;
		render();
	}

	elements.flip?.addEventListener('click', flip);
	elements.card?.addEventListener('click', flip);
	elements.next?.addEventListener('click', () => goTo(state.index + 1));
	elements.previous?.addEventListener('click', () => goTo(state.index - 1));
	elements.shuffle?.addEventListener('click', shuffle);
	elements.reset?.addEventListener('click', () => {
		state.known.clear();
		saveStorage();
		render();
	});
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
		const card = { id: `custom-${Date.now()}`, question, answer, deck: state.deck === 'all' ? 'My cards' : state.deck };
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
