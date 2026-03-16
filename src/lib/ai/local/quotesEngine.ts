// src/lib/ai/local/quotesEngine.ts
//
// Offline quotes fallback engine.
// Used ONLY when no LLM is available (mobile offline mode).
// For online paths, callImotaraAI generates quotes dynamically in any language.
//
// ~80 quotes from philosophers, poets, scientists, spiritual leaders, and thinkers
// spanning cultures: Rumi, Marcus Aurelius, Buddha, Tagore, Gandhi, Seneca,
// Maya Angelou, Thich Nhat Hanh, Einstein, Vivekananda, Camus, and many more.
// Selected by emotional signal + seed. ~1 in 5 emotional turns.

export type QuoteSignal = "sad" | "anxious" | "angry" | "tired";

interface Quote {
    readonly text: string;
    readonly author: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sad / Grief / Loss
// ─────────────────────────────────────────────────────────────────────────────
const SAD: readonly Quote[] = [
    { text: "The wound is the place where the Light enters you.", author: "Rumi" },
    { text: "What we once enjoyed and deeply loved we can never lose, for all that we love deeply becomes part of us.", author: "Helen Keller" },
    { text: "The most beautiful people we have known are those who have known defeat, known suffering, known struggle, known loss, and have found their way out of the depths.", author: "Elisabeth Kübler-Ross" },
    { text: "In the depth of winter, I finally learned that within me there lay an invincible summer.", author: "Albert Camus" },
    { text: "Even the darkest night will end and the sun will rise.", author: "Victor Hugo" },
    { text: "Joy and sorrow are inseparable. Together they come, and when one sits alone with you at your board, remember that the other is asleep upon your bed.", author: "Kahlil Gibran" },
    { text: "You cannot prevent the birds of sorrow from flying over your head, but you can prevent them from building nests in your hair.", author: "Chinese proverb" },
    { text: "Grief is not a disorder, a disease, or a sign of weakness. It is an emotional, physical, and spiritual necessity, the price you pay for love.", author: "Doug Manning" },
    { text: "Only people who are capable of loving strongly can also suffer great sorrow, but this same necessity of loving serves to counteract their grief and heals them.", author: "Leo Tolstoy" },
    { text: "There is a sacredness in tears. They are not the mark of weakness, but of power.", author: "Washington Irving" },
    { text: "The darker the night, the brighter the stars.", author: "Fyodor Dostoevsky" },
    { text: "To live in hearts we leave behind is not to die.", author: "Thomas Campbell" },
    { text: "The heart was made to be broken.", author: "Oscar Wilde" },
    { text: "Sorrow is how we learn to love. Your heart's not breaking. It hurts because it worked.", author: "Rita Mae Brown" },
    { text: "We are healed from suffering only by experiencing it to the full.", author: "Marcel Proust" },
    { text: "Stars can't shine without darkness.", author: "D.H. Sidebottom" },
    { text: "If you're going through hell, keep going.", author: "Winston Churchill" },
    { text: "Out of difficulties grow miracles.", author: "Jean de La Bruyère" },
    { text: "The soul would have no rainbow had the eyes no tears.", author: "John Vance Cheney" },
    { text: "One must have chaos in oneself in order to give birth to a dancing star.", author: "Friedrich Nietzsche" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Anxious / Fear / Worry
// ─────────────────────────────────────────────────────────────────────────────
const ANXIOUS: readonly Quote[] = [
    { text: "The present moment is the only moment available to us, and it is the door to all moments.", author: "Thich Nhat Hanh" },
    { text: "Nothing in life is to be feared; it is only to be understood. Now is the time to understand more, so that we may fear less.", author: "Marie Curie" },
    { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
    { text: "Anxiety does not empty tomorrow of its sorrows, but only empties today of its strength.", author: "Charles Spurgeon" },
    { text: "The cave you fear to enter holds the treasure you seek.", author: "Joseph Campbell" },
    { text: "Fear is a reaction. Courage is a decision.", author: "Winston Churchill" },
    { text: "Feelings are just visitors. Let them come and go.", author: "Mooji" },
    { text: "Rule your mind or it will rule you.", author: "Horace" },
    { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "A.A. Milne" },
    { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
    { text: "Nothing diminishes anxiety faster than action.", author: "Walter Anderson" },
    { text: "I am not afraid of storms, for I am learning how to sail my ship.", author: "Louisa May Alcott" },
    { text: "The greatest weapon against stress is our ability to choose one thought over another.", author: "William James" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "Worry often gives a small thing a big shadow.", author: "Swedish proverb" },
    { text: "Our anxiety does not come from thinking about the future, but from wanting to control it.", author: "Kahlil Gibran" },
    { text: "You wouldn't worry so much about what others think of you if you realized how seldom they do.", author: "Eleanor Roosevelt" },
    { text: "Take the first step in faith. You don't have to see the whole staircase.", author: "Martin Luther King Jr." },
    { text: "Worrying is carrying tomorrow's load with today's strength.", author: "Corrie Ten Boom" },
    { text: "Do not anticipate trouble, or worry about what may never happen. Keep in the sunlight.", author: "Benjamin Franklin" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Angry / Frustrated / Hurt by injustice
// ─────────────────────────────────────────────────────────────────────────────
const ANGRY: readonly Quote[] = [
    { text: "For every minute you remain angry, you give up sixty seconds of peace of mind.", author: "Ralph Waldo Emerson" },
    { text: "Holding on to anger is like grasping a hot coal with the intent of throwing it at someone else; you are the one who gets burned.", author: "Buddha" },
    { text: "Anger is an acid that can do more harm to the vessel in which it is stored than to anything on which it is poured.", author: "Mark Twain" },
    { text: "The best fighter is never angry.", author: "Lao Tzu" },
    { text: "Where there is anger, there is always pain underneath.", author: "Eckhart Tolle" },
    { text: "The weak can never forgive. Forgiveness is the attribute of the strong.", author: "Mahatma Gandhi" },
    { text: "He who angers you conquers you.", author: "Elizabeth Kenny" },
    { text: "You will not be punished for your anger; you will be punished by your anger.", author: "Buddha" },
    { text: "Consider how much more you often suffer from your anger and grief than from those very things for which you are angry and grieved.", author: "Marcus Aurelius" },
    { text: "Speak when you are angry and you will make the best speech you will ever regret.", author: "Ambrose Bierce" },
    { text: "If you kick a stone in anger, you'll hurt your own foot.", author: "Korean proverb" },
    { text: "I would not look upon anger as something foreign to me that I have to fight. I have to deal with it, to look at it, and to be in touch with it.", author: "Thich Nhat Hanh" },
    { text: "Bitterness is like cancer. It eats upon the host. But anger is like fire. It burns it all clean.", author: "Maya Angelou" },
    { text: "One who is injured ought not to return the injury, for on no account can it be right to do an injustice; and it is not right to return an injury, or to do evil to any man, however much we have suffered from him.", author: "Socrates" },
    { text: "Resentment is like drinking poison and waiting for the other person to die.", author: "Saint Augustine" },
    { text: "Be not angry that you cannot make others as you wish them to be, since you cannot make yourself as you wish to be.", author: "Thomas à Kempis" },
    { text: "Anger, if not restrained, is frequently more hurtful to us than the injury that provokes it.", author: "Seneca" },
    { text: "Anybody can become angry — that is easy. But to be angry with the right person, and to the right degree, and at the right time, and for the right purpose — that is not easy.", author: "Aristotle" },
    { text: "Pain is what we carry when we cannot speak our truth.", author: "Gabor Maté" },
    { text: "In a controversy the instant we feel anger, we have already ceased striving for the truth.", author: "Mahatma Gandhi" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tired / Exhausted / Drained
// ─────────────────────────────────────────────────────────────────────────────
const TIRED: readonly Quote[] = [
    { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
    { text: "Rest is not idleness, and to lie sometimes on the grass under trees on a summer's day is by no means a waste of time.", author: "John Lubbock" },
    { text: "Taking care of yourself doesn't mean me first, it means me too.", author: "L.R. Knost" },
    { text: "Sometimes the most productive thing you can do is rest.", author: "Mark Black" },
    { text: "You are allowed to be both a masterpiece and a work in progress simultaneously.", author: "Sophia Bush" },
    { text: "For fast-acting relief, try slowing down.", author: "Lily Tomlin" },
    { text: "Slow down and everything you are chasing will come around and catch you.", author: "John De Paola" },
    { text: "It is not the mountain we conquer, but ourselves.", author: "Edmund Hillary" },
    { text: "There is virtue in work and there is virtue in rest. Use both and overlook neither.", author: "Alan Cohen" },
    { text: "Even the strongest trees bend in the wind. Rest is how they hold.", author: "Chinese proverb" },
    { text: "The time to relax is when you don't have time for it.", author: "Sydney J. Harris" },
    { text: "Nourishing yourself in a way that helps you blossom in the direction you want to go is attainable, and you are worth the effort.", author: "Deborah Day" },
    { text: "Self-care is how you take your power back.", author: "Lalah Delia" },
    { text: "Your present circumstances don't determine where you can go; they merely determine where you start.", author: "Nido Qubein" },
    { text: "When you feel like quitting, think about why you started.", author: "Unknown" },
    { text: "You don't always need a plan. Sometimes you just need to breathe, trust, let go, and see what happens.", author: "Mandy Hale" },
    { text: "He that can have patience can have what he will.", author: "Benjamin Franklin" },
    { text: "Burnout is what happens when you try to avoid being human for too long.", author: "Michael Gungor" },
    { text: "In the sweetness of friendship let there be laughter, and sharing of pleasures. For in the dew of little things the heart finds its morning and is refreshed.", author: "Kahlil Gibran" },
    { text: "Even the sun sets each evening so it can rise again tomorrow.", author: "African proverb" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────
const QUOTE_BANK: Record<QuoteSignal, readonly Quote[]> = {
    sad: SAD,
    anxious: ANXIOUS,
    angry: ANGRY,
    tired: TIRED,
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a formatted quote for the given emotional signal, or null if:
 *   - signal is not one of the four covered emotions, or
 *   - the seed hash doesn't land on a quote turn (~1 in 5).
 *
 * Uses bit-window (seed >>> 11) to avoid collision with:
 *   - storyEngine   (seed >>> 7)
 *   - mythologyEngine (seed >>> 9)
 *
 * Offline fallback only. For online paths, callImotaraAI generates quotes
 * dynamically in the user's language.
 */
export function buildOfflineQuote(
    signal: string,
    seed: number,
): string | null {
    const pool = QUOTE_BANK[signal as QuoteSignal];
    if (!pool) return null;

    // ~1 in 5 turns
    if ((seed >>> 11) % 5 !== 0) return null;

    const q = pool[seed % pool.length]!;
    return `"${q.text}" — ${q.author}`;
}
