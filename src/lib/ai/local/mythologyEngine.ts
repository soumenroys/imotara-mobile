// src/lib/ai/local/mythologyEngine.ts
//
// World mythology engine — offline/rule-based path.
// Covers 7 cultural traditions. Selection is language-aware:
//   - Indian languages (hi, bn, ta, te, etc.) → Indian 70%, world 30%
//   - Other languages → own culture 60%, Indian 35%, other 5%
//   - Indonesian (id) → Indian primary (deep Hindu/Buddhist cultural influence)
//   - English (en) → Indian primary (Imotara is an Indian product)
//
// For LLM paths, the chat-reply system prompt handles mythology natively
// with full language and cultural awareness.
//
// Offline injection is English-only (stories are in English).
// Callers apply the language-gate; this engine only handles cultural selection.

export type MythSignal = "sad" | "anxious" | "angry" | "tired";

type CulturePool = Record<MythSignal, readonly string[]>;

// ─────────────────────────────────────────────────────────────────────────────
// INDIAN  (Mahabharata, Ramayana, Gita, Puranas, Jataka, Panchatantra, Upanishads)
// ─────────────────────────────────────────────────────────────────────────────
const INDIAN: CulturePool = {
    sad: [
        "In the Mahabharata, Karna was born with divine armor fused to his skin — a gift of the sun god — yet abandoned by his mother at birth and raised by a charioteer. He was denied his place among warriors his whole life despite being their equal in every measure. He kept showing up anyway — loyal, generous, and whole — not because the world was fair, but because that was who he chose to be.",

        "There is the story of Savitri in the ancient texts, who followed Death itself into the forest when it came for her husband. She did not beg for miracles — she simply refused to stop walking, and answered Death's questions so wisely that it eventually relented. Her love did not need permission to be powerful.",

        "A Buddhist story tells of Kisagotami, who carried her dead child from door to door asking for medicine, until the Buddha asked her to bring a mustard seed from a house where no one had ever died. She went from house to house, and slowly she understood — grief is not punishment; it is the price of having loved.",

        "In the Ramayana, Sita was exiled into the forest by the very person she had stood beside through every trial. She raised her sons alone, in silence, and when she was finally asked to prove herself again — she chose the earth instead. Her dignity was never contingent on being believed.",

        "In the Ramayana, King Dasharatha sent his beloved son Rama into exile, bound by a promise made years before, and died of grief just three days later. He had the power of a king, but not the power to undo a single word — a reminder that love and control are not the same thing.",

        "In the Puranas, Radha's devotion to Krishna was marked as much by his absence as his presence. The longing itself was considered sacred — not a wound to be healed, but a form of connection that does not require the other person to be in the room.",

        "When Siddhartha left in the night to begin his path, his wife Yashodhara woke to find him gone. She raised their son alone, and when she finally met him again years later, she chose neither anger nor collapse — she bowed, not because he was right, but because she had found her own completeness in the meantime.",

        "In the Bhagavata Purana, King Bharata gave up his kingdom for the forest — and then became deeply attached to an orphaned deer he had raised. When he died, his last thought was of the deer. The story is not a punishment; it is an acknowledgment that what we carry with us stays, and that tenderness is never wasted even when misplaced.",

        "In the Upanishads, young Nachiketa sat at the door of Yama for three days — no food, no shelter, no assurance the door would ever open. When Death returned and offered riches to abandon his question, Nachiketa refused. Grief, he understood, could become a doorway to something real.",

        "In the Mahabharata, Draupadi was dragged to the court and humiliated before her husbands, her elders, and the whole assembly. Not one person rose. She did not collapse — she asked one sharp question that no one in that hall could answer, and that silence became her proof. Her dignity did not depend on their response.",

        "In the Mahabharata, Kunti carried for her entire life the knowledge that Karna — the great warrior on the opposing side — was her firstborn son. She had abandoned him as a young woman and could never claim him. On the eve of war, she finally told him. He listened, wept, and refused to switch sides. They both bore the weight of it. Some things cannot be undone — only held.",

        "A Jataka tale describes a mother crow who lost her young in a storm and spent days calling into the silence. A sage watching her thought: there is no comfort I can offer that will change what happened. What matters now is whether she keeps living. She did.",
    ],

    anxious: [
        "In the Bhagavad Gita, Arjuna — the finest warrior in the world — sat down in the middle of the battlefield and could not lift his bow. He was not afraid of dying; he was overwhelmed by everything that could go wrong, everyone he might hurt. Krishna sat with him in that moment. What followed was not a battle cry — it was a careful, honest conversation about fear and action.",

        "In the Ramayana, before Hanuman leaped across the ocean to Lanka, he paused — uncertain whether his body could carry him that far. It was Jambavan, the wise elder, who reminded him: you have forgotten your own strength. Hanuman had always had it. He just needed someone to say it out loud.",

        "In the Puranas, young Prahlada refused to stop his devotion even as his own father threatened him with fire, serpents, and war elephants. He was not brave because he knew nothing could harm him. He was brave because he had decided that fear of consequences would not govern his choices.",

        "A young boy named Dhruva, hurt by his stepmother's cruelty, walked alone into the forest to seek the divine — at five years old, with no map and no certainty. When he returned, he had not found what he expected. He had found himself. The forest had not changed. He had.",

        "In the Puranas, the gods and demons churned the cosmic ocean in search of the nectar of immortality. Before the nectar came, the ocean released a terrible poison that threatened everything. Shiva drank it and held it in his throat, turning blue. What you fear emerging from the depths may not be the end — it may be calling for a different kind of courage.",

        "In the Ramayana, the night before the great battle at Lanka, even Rama could not sleep. The stakes were enormous, the outcome unknown. He did not pretend the doubt away — he acknowledged it, said his prayers, and rose in the morning. Not certainty. Just continuation.",

        "A Jataka tale tells of a hare who heard the sound of a falling fruit and ran, convinced the world was ending. Hundreds of animals heard him and ran too — a stampede of borrowed fear. The Bodhisattva came down from a hill and asked the hare to trace where it started. It ended at a single fallen fruit.",

        "In the Panchatantra, a deer stood for hours outside a pond, afraid to drink because he saw his reflection and thought it was another animal. He nearly died of thirst waiting for the 'threat' to leave. His friends watched patiently until he finally walked forward — and the reflection dissolved into ripples.",

        "In the Mahabharata, Yudhishthira reached a lake to drink and was stopped by a Yaksha who asked: what is the greatest wonder in the world? Yudhishthira answered — every day, people die, and yet those who remain live as if they will not. Not denial. Just presence, in the face of the unknown.",

        "The sage Viswamitra had worked for decades toward a goal he was not certain he could reach, knowing that Indra would send obstacles. He sat still. Every test came, and he sat still, until even Brahma acknowledged him. He had no guarantee. He had patience.",

        "In the Katha Upanishad, young Nachiketa waited at Death's gate for three days. When Yama returned and offered him palaces and pleasures to drop his question, Nachiketa refused. He had come for one thing, and no discomfort had changed that. Sometimes the truest kind of courage is just not moving.",

        "In a Buddhist story, Ananda — the Buddha's closest disciple — worked for decades but could not reach enlightenment while the Buddha was alive. The night after the Buddha passed, Ananda sat alone with his grief and his effort. In that night, he let go of the effort itself — and arrived.",
    ],

    angry: [
        "In the Puranas, Parashurama was so consumed by rage after his father's death that he vowed to rid the world of warriors — and did so, again and again, for twenty-one generations. He had strength and cause. But the anger never filled what had been taken. After the wars ended, he went to the mountains alone. Sometimes anger is the last wall between us and the grief beneath it.",

        "Vishwamitra was a powerful king who attacked a sage's hermitage out of pride, lost, and burned with rage. He chose to transform that fire — not by suppressing it, but by turning it into tapas, into discipline, into decades of quiet work. He did not become a sage by losing his intensity. He became one by learning to direct it.",

        "In the Mahabharata, Duryodhana refused every peace offer, every chance to avert war. Not because he lacked intelligence — but because his anger had become his identity. To accept peace would have meant accepting that the Pandavas had a right to exist alongside him. He chose war over that. Not all anger leads there, but unexamined anger always costs something.",

        "In the Puranas, the goddess Kali was summoned from Durga's wrath to destroy a demon that multiplied from every drop of blood. She consumed everything in her fury — until Shiva lay down beneath her feet. Feeling him there, she stopped. Even in divine anger, there is a moment when something beneath it calls it back.",

        "In the Mahabharata, Bhima swore terrible oaths after Draupadi's humiliation — oaths that took twelve years of exile to fulfill. His anger was real and just. But the years between the oath and the fulfillment cost him, cost everyone. The anger was not wrong. The question was: what does it do while it waits?",

        "After the war at Kurukshetra, Gandhari — who had worn a blindfold for decades to share her husband's blindness — finally looked at Krishna with uncovered eyes and cursed him. Her grief was vast, her anger completely understandable. Krishna accepted the curse without argument. Even when anger is entirely justified, it can outlast its original purpose.",

        "In the Mahabharata, Drona was struck with grief when he was told — falsely — that his son had died. He dropped his weapons. He was killed in that unguarded moment. What looked like defeat was actually grief so large it had nowhere to go but down. Anger and grief are close neighbors.",

        "In the Puranas, Indra insulted his own teacher, Brihaspati, out of pride — and found himself stripped of his kingdom. He wandered in shame for years before he earned it back through devotion. The humbling was not punishment. It was the only way his pride could dissolve enough for him to grow.",

        "In a Jataka tale, two oxen — one fierce, one gentle — were harnessed to the same cart. The fierce one kicked and struggled and made the whole journey difficult. The gentle one walked steady. The merchant gave the better load to the gentle ox — not because gentleness is weakness, but because it requires more strength.",

        "In the Puranas, when Sati died and Shiva carried her body across the world in grief and rage, the universe trembled. It was Vishnu who quietly cut the body away piece by piece so Shiva could eventually set it down. Some griefs are so vast they look like anger — and they need the world to patiently take pieces until breathing becomes possible again.",

        "In the Katha Upanishad, Nachiketa was given to Yama by his own father in a burst of rage. Nachiketa stood at Death's gate without bitterness — and when Yama returned, he asked not for revenge but for wisdom. He had every right to anger. He chose something else.",

        "In the tales of King Vikramaditya, a spirit would offer him great gifts in exchange for justice, and whenever he let vanity or anger govern him — even slightly — the gift would vanish. He learned that the moment ego entered his anger, he lost the very thing the anger was trying to protect.",
    ],

    tired: [
        "In the Ramayana, Rama lived fourteen years in the forest — not as punishment, but because he chose his father's honor over his own comfort. He did not count the days. He tended to the days that were actually there, one at a time, and eventually those days became a kingdom.",

        "In the Puranas, the gods and demons churned the great ocean for thousands of years before anything of value emerged. The churning required everyone to keep pulling, even when nothing was visible. The nectar of immortality could not have appeared earlier. Some things only come after enormous, sustained effort.",

        "In the Mahabharata, Ekalavya was turned away by Drona as a student. So he built a clay statue of Drona in the forest and taught himself — practicing every day, with no teacher, no encouragement, no witness. He became a master. Not because someone showed up for him. Because he kept showing up for himself.",

        "In the Mahabharata, the Pandavas spent twelve years in exile and then one full year in disguise — each living a smaller, hidden version of their life. Yudhishthira's discipline was not heroic in the way songs describe. It was simply: one day, then the next, then the next.",

        "In the Katha Upanishad, young Nachiketa waited at the door of Yama's palace for three days — no food, no water, no assurance the door would open. He did not leave. He did not bargain. He simply stayed. Sometimes what looks like waiting is actually a form of deep, quiet courage.",

        "In the Ramayana, when Hanuman could not identify which herb would heal Lakshmana, he lifted the entire mountain and carried it. He had been awake, in battle, in danger — but none of that stopped him from doing what needed to be done. He did not do it with ease. He did it.",

        "Siddhartha sat under the Bodhi tree for weeks, facing every storm of the mind — doubt, desire, fear, despair. He did not get up and try again later. He stayed until the sitting itself became something different. Exhaustion was part of the path, not a sign that the path was wrong.",

        "In the old texts, Shravan Kumar carried his elderly, blind parents on a pilgrimage across India in a bamboo pole, stopping at every sacred site so they could fulfill their wishes. He did not make it a hardship to speak of. He made it something to complete. Sometimes devotion is just that — doing the thing, day after day.",

        "Drona, before he became the greatest weapons teacher of his age, lived in such poverty that his young son once cried because there was no milk. He mixed flour in water and gave it to the boy as milk. From that moment, he decided he would learn what he needed to learn — not for fame, but to give his son something real. Exhaustion was not the end of the story.",

        "Viswamitra sat in tapas for so many years that his body thinned and the world moved on around him. At one point, a woman offered him food that would have broken his vow — but to survive and continue, he accepted it. He found his way by bending without breaking.",

        "In the Mahabharata, Vidura — the wisest man in Hastinapura — spent his entire life advising a court that did not listen. He knew what would happen. He said it clearly, again and again. He was ignored. He served anyway. There is a tiredness that comes not from effort but from caring deeply in a place that does not care back. He kept caring anyway.",

        "A Jataka tale describes a turtle crossing an enormous distance — slowly, consistently, without hurry. Birds laughed at how long it was taking. The turtle did not change its pace. It arrived. Not first. But it arrived.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// GREEK / ROMAN
// ─────────────────────────────────────────────────────────────────────────────
const GREEK_ROMAN: CulturePool = {
    sad: [
        "In Greek mythology, Orpheus descended into the Underworld to bring back his beloved Eurydice, moving even Death itself with his music. He was given the chance to lead her back — on one condition: do not look back. He looked, and lost her again. The story has endured for millennia because grief makes us reach for what we cannot hold.",

        "In the Odyssey, Penelope waited twenty years for Odysseus to return — weaving a shroud by day and unraveling it at night. She did not wait passively; she waited in ingenuity, in the quiet work of keeping something alive. Faithfulness, the myth tells us, is not one act but a thousand daily choices.",

        "When Persephone was taken into the Underworld, her mother Demeter let the earth go cold. The seasons themselves became grief made visible. The myth's strange gift: it tells us that even the world mourns — and that spring still comes.",

        "In the Iliad, when Achilles lost his companion Patroclus, the greatest warrior in the Greek army sat on the shore and wept — refusing to eat, refusing to fight. His grief was not weakness; it was the measure of how deeply he had loved.",
    ],

    anxious: [
        "In the Odyssey, Odysseus faced a decade of storms, monsters, and detours. At each impossible moment, he did not resolve the whole journey — he resolved the next step. That became the pattern that brought him home.",

        "In Greek myth, Perseus was sent to bring back Medusa's head — whose gaze turned men to stone. He could not look directly at the threat. He used a mirror. Sometimes what paralyzes us cannot be faced head-on — it has to be approached at an angle.",

        "Above the entrance to the Oracle at Delphi were inscribed two words: 'Know thyself.' Not 'know the future' — know yourself. Anxiety often asks 'what will happen?' but the deeper question is 'who am I in this moment?'",

        "Albert Camus wrote of Sisyphus — condemned to roll a stone up a hill forever, watching it fall back. He ended his essay: 'one must imagine Sisyphus happy.' Not because the burden disappears, but because the person carrying it chooses how to carry it.",
    ],

    angry: [
        "The Iliad opens with one word: 'Rage.' Achilles's anger at Agamemnon starts a chain that costs him his closest friend and nearly destroys the Greek army. He was right to be wronged. But his rage consumed everything he hadn't meant to burn.",

        "In Greek tragedy, Medea's fury at being abandoned was total. Her anger was not unreasonable — she had given everything and been discarded. But the story asks: at what point does righteous anger begin consuming what it was trying to protect?",

        "Prometheus gave fire to humanity and was chained to a rock as punishment — an eagle eating his liver each day. His was the anger of someone who saw injustice clearly and acted anyway, knowing the cost. There are times when anger is the most honest form of love.",

        "Hera's wrath in Greek mythology is constant — she pursues every grievance with the full power of a goddess. And yet the myths rarely end with Hera satisfied. The anger is always reignited by the next slight. The stories seem to ask: what would it finally take to be enough?",
    ],

    tired: [
        "In Greek myth, Hercules was given twelve impossible labors — not as achievement, but as penance. The labors were not designed to be winnable. He completed them not because victory was guaranteed, but because he kept going when it wasn't.",

        "Atlas was condemned to hold up the sky forever. Hercules briefly took it from him, and in that moment Atlas experienced what it was to put something down. Sometimes the most important thing is to let someone else carry it for a while.",

        "Penelope's faithfulness over twenty years was not one act of love but twenty years of daily choices — to weave, to wait, to hold. Endurance is rarely heroic in the moment. It is made of repetition.",

        "The myth of Sisyphus can be read as the story of anyone doing work that never feels finished. Camus's interpretation was not despair — it was this: find meaning not in the summit, but in choosing to go again.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CHINESE / TAOIST
// ─────────────────────────────────────────────────────────────────────────────
const CHINESE: CulturePool = {
    sad: [
        "When Zhuangzi's wife died, he was found singing and drumming on a bowl. His friend was horrified. Zhuangzi said: 'She has returned through the great changes — earth to form, form to breath, breath to life, and now back. To weep endlessly seemed like not understanding the nature of things.' Not detachment — a different kind of presence with loss.",

        "In Chinese legend, the Weaver Girl and the Cowherd were separated by the Milky Way, allowed to meet only once a year when magpies form a bridge across the stars. Their love was not diminished by distance. The myth says: some connections are larger than proximity.",

        "Confucius stood by a river and said: 'It flows on like this — never ceasing, day or night.' He was not mourning the passing of time. He was saying: grief, too, moves. Nothing stays in one form forever.",

        "A Chinese fable tells of a farmer whose horse ran away. 'What terrible luck,' said the neighbors. 'Maybe,' he said. It returned with wild horses. 'What great luck.' 'Maybe.' His son broke his leg training them. 'Terrible luck.' 'Maybe.' The army came — his son was not taken to war. Loss does not always stay as loss.",
    ],

    anxious: [
        "Zhuangzi dreamed he was a butterfly — free, not knowing he was Zhuangzi. He woke, and was Zhuangzi again. But he wondered: was he a man dreaming of a butterfly, or a butterfly dreaming of being a man? It is an invitation to hold all certainty a little more lightly.",

        "A core teaching of Taoism: Wu Wei — acting in accord with the natural flow, without forcing. Not passivity, but not struggle either. The tallest trees bend in wind; it is the rigid ones that break.",

        "In Zhuangzi, a cook carves an ox with such perfect understanding that his knife glides through spaces without effort. He says: 'I work with my mind, not my eyes.' When worry fills a situation, it is often because we are working with fear rather than with understanding.",

        "Laozi wrote: 'Nothing in the world is as soft and yielding as water. Yet for dissolving the hard and inflexible, nothing can surpass it.' Anxiety is often the feeling of being rigid in the face of the flowing. Water does not fight the stone. It goes around.",
    ],

    angry: [
        "Confucius said: 'When you are angry, think of the consequences.' Not to suppress the anger, but to see it fully — where it leads, what it is protecting, what it might cost.",

        "Sun Tzu wrote: 'The supreme art of war is to subdue the enemy without fighting.' Anger rarely knows the full situation. It knows only how much it has been hurt.",

        "Zhuangzi described a man rowing who was struck by another boat. He shouted in fury — then saw the boat was empty. The anger dissolved instantly. He asked: would it be so different if the boat had a distracted man in it? The empty boat reminds us: we often fill the other person with intent they may not have.",

        "In Zhuangzi, a wheelwright tells a Duke that the books he reads are merely dregs of dead men. The Duke is furious. The wheelwright explains: the real understanding cannot be fully put into words. Anger at others is sometimes anger at the gap between what we need to feel and what can be expressed.",
    ],

    tired: [
        "Laozi wrote: 'Doing nothing, nothing is left undone.' It is one of the most misunderstood lines in Taoism. It does not mean laziness — it means stop forcing, stop pushing against the grain, and sometimes what seemed immovable begins to move.",

        "A Chinese parable tells of a gnarled, useless tree that no carpenter would cut down. In its uselessness, it grew enormous and ancient. A man dreamed the tree spoke: 'You useful trees are cut young. I survived by being useless.' There is something in rest that is not failure.",

        "Laozi wrote: 'The valley spirit never dies.' A valley endures because it does not resist — it receives everything and holds it. Exhaustion sometimes comes not from doing too much but from holding too tightly.",

        "In a Chinese legend, the Yellow Emperor fell asleep and dreamed of a perfect kingdom where everything was in its right place. He woke and spent the rest of his reign not building but recognizing what was already there. Sometimes what we are exhausted from seeking, we already have.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ISLAMIC / SUFI
// ─────────────────────────────────────────────────────────────────────────────
const ISLAMIC_SUFI: CulturePool = {
    sad: [
        "When Rumi's beloved teacher Shams-i-Tabrizi disappeared, Rumi's grief was absolute. He searched for him and wrote thousands of poems — and eventually understood that the longing itself had become the teaching. 'I have lived on the lip of insanity,' he wrote, 'wanting to know reasons, knocking on a door. It opens. I've been knocking from the inside.'",

        "The Masnavi opens with the cry of a reed flute, cut from its reed bed, longing to return. Rumi says: everyone who stays far from their origin longs to return. The pain of separation is not something to fix — it is proof of what you came from.",

        "Ibrahim ibn Adham was a king who gave up his throne after a series of encounters that made him understand: none of it was what he was truly looking for. He wept for years — not from sadness alone but from the awareness of how much time had passed before he turned toward what mattered.",

        "A Sufi parable: a man lost his beloved ring in the dark and searched for hours under a lamppost. A passerby asked why he was looking there if he'd dropped it inside. 'Because the light is here,' he said. Grief sometimes searches where the light is, not where the thing was lost.",
    ],

    anxious: [
        "Rumi wrote: 'Past and future veil God from our sight; burn up both of them with fire.' He was not saying the future doesn't matter. He was saying: peace is only available now, in this moment. Worry is a kind of journey away from the only place where rest is possible.",

        "A key teaching in Sufi thought is tawakkul — complete trust and surrender. A hadith says: 'Tie your camel, then put your trust in God.' Not passive resignation — but action followed by release. Do what can be done, then let go of what cannot.",

        "A Mulla Nasruddin story: a man ran toward him in terror shouting, 'A tiger is chasing me!' Nasruddin replied: 'How far behind is it?' 'Very far.' 'Then why are you running so fast?' Some of what we flee has not yet arrived — and may not.",

        "A Sufi story: a man about to cross a river asked a dervish whether it was safe. The dervish walked across ankle-deep. 'The water is only this deep.' 'But what if there are deeper spots?' The dervish replied: 'Then you will find them — and they will only be as deep as they are.'",
    ],

    angry: [
        "A man used to throw garbage on the Prophet every day as he passed. One day he did not. The Prophet went to ask after him and found he was ill. He visited and offered help. The story is not about being passive — it is about what it costs to let resentment define your response.",

        "Rumi wrote: 'Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.' Anger at others is often the last defense against the harder work of looking inward.",

        "Hafez wrote: 'Even after all this time, the sun never says to the earth: you owe me. Look what happens with a love like that — it lights the whole sky.' Anger keeps a ledger; love burns it.",

        "A Sufi teacher was publicly insulted and expected to respond. He said: 'If you gave me a gift and I did not accept it, who would the gift belong to?' The man said: 'To me.' The teacher said: 'Then I do not accept your insult.'",
    ],

    tired: [
        "Rumi wrote: 'Be empty of worrying. Think of who created thought. Why do you stay in prison when the door is so wide open?' Rest in his poetry is a dissolving of the grip — not passivity, but the exhaustion of the ego finally setting down what it has been holding.",

        "A Sufi teaching: the river does not rest before reaching the sea — but it does not fight the land either. It flows around obstacles. The river's journey is not effortless; it is simply not wasted on resistance.",

        "Omar Khayyam wrote: 'This life is but a caravanserai — a rest stop, not a home.' Not despair, but permission. You are not meant to carry everything forever. You are meant to rest here, and then continue.",

        "The Sufi concept of sabr — patient endurance — is not resignation. It is the act of continuing without bitterness, not because the difficulty has ended but because you have found what does not depend on the difficulty ending.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NORSE / SLAVIC
// ─────────────────────────────────────────────────────────────────────────────
const NORSE_SLAVIC: CulturePool = {
    sad: [
        "In Norse mythology, Baldur the Beautiful was loved by everything in creation — except a single mistletoe that had been overlooked. Loki used that one oversight to kill him. The gods wept. Even the stones wept. And Odin, sitting with his grief, knew the story wasn't over — Baldur would return after the world's great renewal.",

        "The goddess Freya searched the nine worlds for her lost husband, weeping golden tears wherever she walked. Her grief was so powerful it became jewelry — turned to gold wherever it touched the earth. Even the Norse understood: love that has been lost leaves something behind.",

        "In Russian folktales, Ivan often loses the thing he loves — and must travel to the ends of the earth to find it again. The journey is never guaranteed. But the stories always begin with the same thing: he set out anyway.",

        "In Norse belief, those who died in battle were carried by the Valkyries to Valhalla — chosen not just for courage but to be honored. The Norse did not look away from loss; they tried to make meaning out of it.",
    ],

    anxious: [
        "Odin hung himself from Yggdrasil, the world tree, for nine days — wounded, without food or water — to receive the runes. He gave his eye to drink from the well of wisdom. The Norse understood that real knowledge required something of you, and that the fear of the cost was often worse than the cost itself.",

        "Thor went fishing for the Midgard Serpent — the creature that encircles the entire world. When it surfaced, he did not back away. He lifted his hammer. Norse mythology is full of characters who face what cannot be defeated and go toward it anyway — because that is what it means to be alive.",

        "In Norse myth, three women called the Norns sit at the roots of the world tree and weave fate. Not even the gods can change what the Norns have woven. The Norse acceptance of fate was not passive — they believed you could face your fate with such courage that it would be worth singing about.",

        "In Slavic folklore, heroes must visit Baba Yaga — the fierce witch at the edge of the forest. She will help you or harm you, depending on how you ask and what you do. The forest that frightens you most often holds what you are looking for.",
    ],

    angry: [
        "Thor's anger in Norse mythology is elemental — literal thunder and lightning. But in the stories that show him at his best, the anger is always directed at genuine threats. The Norse distinguished between rage that protects and rage that destroys.",

        "Loki began as a trickster — chaotic but creative, bending rules to solve impossible problems. But over time, his resentments accumulated until they became irreversible. His story asks: at what point does clever bitterness become something that cannot be undone?",

        "Sigurd killed the dragon Fafnir not out of rage, but out of purpose. He dug a pit and waited. The anger was channeled into a plan — and the plan was what succeeded. The Norse sagas distinguished carefully between warriors who fight in rage and those who fight with intention.",

        "In Slavic folk tales, the hero often faces a giant whose power seems absolute. The giant cannot be defeated by force alone. The hero must use wit, patience, and respectful cleverness. Pure anger at what is larger than you usually ends the story badly.",
    ],

    tired: [
        "In Norse prophecy, before Ragnarök comes Fimbulwinter — three years of endless winter with no summer between. Even the gods were tired. The world itself grew exhausted before its great ending and beginning. And the world still turned.",

        "Odin spent much of his existence traveling disguised — a wandering old man, learning what the world held. He was not resting. But the wandering itself was rest of a kind — movement that did not demand arrival.",

        "Yggdrasil, the world tree, has its roots gnawed by serpents from below. It holds everything together — and it is never done holding. Even the tree at the center of all worlds does not get to rest. But it endures.",

        "In Slavic tales, the hero always returns home eventually — often unrecognized, often changed past the point where home feels like home anymore. The exhaustion of the journey is real. But so is the return.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// JAPANESE / ZEN / BUDDHIST
// ─────────────────────────────────────────────────────────────────────────────
const JAPANESE_ZEN: CulturePool = {
    sad: [
        "Japanese aesthetics has a concept: mono no aware — the bittersweet awareness of impermanence. Cherry blossoms are loved precisely because they fall. The beauty is inseparable from the passing. Not all grief is a wound. Some of it is just seeing clearly.",

        "In Shinto mythology, Izanagi descended into Yomi — the realm of the dead — to bring back his wife. He was told not to look at her. He looked. She was already changed by death. He fled. The story asks: what does love owe the dead, and what does it owe the living?",

        "A Zen story: a monk was weeping at his teacher's grave. Another monk asked: didn't you teach that death was simply change? The weeping monk said: 'I weep because I weep.' The grief does not need a philosophy to justify it. It is simply what is here.",

        "In Zen, mushin — 'no mind' — is the state of meeting each moment without the weight of the past. Not forgetting, but not carrying. A grief that has been fully felt does not become nothing; it becomes something you can set down.",
    ],

    anxious: [
        "A Zen master poured tea into a visitor's cup and kept pouring even as it overflowed. 'Like this cup,' he said, 'you are full of your own opinions and worries. How can anything new enter unless you first empty your cup?' The anxiety that fills us leaves no room for what would actually help.",

        "Zen monks are given koans — impossible questions like 'what is the sound of one hand clapping?' They are not meant to be solved by thinking. They are meant to exhaust the thinking mind until something deeper opens. Some anxieties are like koans: keep working them until the question itself dissolves.",

        "A fearsome samurai came to a Zen master demanding to be taught about heaven and hell. The master insulted him. The samurai drew his sword in fury. The master said: 'That is hell.' The samurai paused, sheathed his sword, bowed. The master said: 'That is heaven.' The gap between them was one breath.",

        "In Zen archery, the student learns that the target is not outside them — it is the stillness inside. The training is not about the arrow. It is about the state of the person releasing it.",
    ],

    angry: [
        "A Buddhist teacher once said: anger is like a coal you hold in your hand intending to throw it at someone. You are the one being burned right now.",

        "A Zen story: a student asked why his anger kept returning even after he had apologized and tried to move on. The master held up a mirror. 'What do you see?' 'Myself.' 'The mirror does not hold what it reflects. Your mind can learn the same.'",

        "A monk saw a scorpion drowning and saved it — and was stung. This happened three times. A passerby asked: why do you keep helping it? The monk said: it is the scorpion's nature to sting. It is my nature to help. Why should I change my nature because it cannot change its?",

        "Zen teaches that the archer who shoots in anger has already missed — before the arrow leaves the bow. The practice is not about the target. It is about what state you shoot from.",
    ],

    tired: [
        "A student asked a Zen master: 'What happens after enlightenment?' The master said: 'Chop wood, carry water.' The work does not change. But the one doing the work has changed. Tiredness sometimes comes not from the work but from the argument with the work.",

        "In Japanese philosophy, bamboo is a model: it bends fully under the weight of snow, then springs back when the snow falls. It does not resist the weight. It carries it and then releases it. Rest is the spring-back, not the avoidance of the snow.",

        "The ideal of wabi-sabi in Japanese aesthetics: finding beauty in imperfection and impermanence. The cracked bowl, the worn path. Exhaustion, too, has its beauty — it is proof of something given fully.",

        "A Zen aphorism: 'Before enlightenment, chop wood, carry water. After enlightenment, chop wood, carry water.' The tasks do not disappear. The relationship with the tasks changes. Rest is not the end of effort — it is effort meeting itself without resistance.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// JEWISH / TALMUDIC
// ─────────────────────────────────────────────────────────────────────────────
const JEWISH: CulturePool = {
    sad: [
        "The Baal Shem Tov, founder of Hasidic Judaism, taught that even sadness is part of the divine — because it pushes us toward connection. 'God is found,' he said, 'in the broken places.' Not despite the grief, but through it.",

        "In the Book of Ruth, Naomi — having lost her husband and both sons — told her daughters-in-law to return to their own people. Ruth said: 'Where you go, I will go. Where you die, I will die.' She chose grief over comfort, connection over safety. The Talmud calls this chesed — lovingkindness without calculation.",

        "The Book of Lamentations is an entire text of grief — written after the destruction of Jerusalem. It does not pretend the grief is small or explain it away. Jewish tradition kept it in scripture. The grief was considered holy enough not to remove.",

        "The Talmud teaches: whoever saves a single life, it is as if they saved an entire world. And: each person should say, 'the world was created for my sake.' Not arrogance — the reminder that you are not a small thing. Even in your grief, you are not a small thing.",
    ],

    anxious: [
        "In the Exodus story, the Israelites stood at the Red Sea with the Egyptian army behind them. There was nowhere to go. According to one interpretation, the sea did not part first — it parted when one person walked in up to his nose. The miracle waited for the first step into the impossible.",

        "Hillel taught: 'If I am not for myself, who will be for me? If I am only for myself, what am I? And if not now, when?' Three questions, each turning the person back toward the moment they are actually in. Not someday. Now.",

        "Rabbi Nachman of Bratslav wrote: 'The world is a very narrow bridge, and the most important thing is not to be afraid at all.' Not: the bridge is wide. Not: the fall is safe. The bridge is narrow — and the task is to walk it without being paralyzed.",

        "In Jewish folklore, the Golem was created to protect. But unchecked, it grew uncontrollable. The stories about the Golem are stories about the thing we build to manage our fear — which eventually must be returned to clay before it destroys what it was meant to guard.",
    ],

    angry: [
        "When Moses came down from Sinai and found the people worshipping the golden calf, he threw down and broke the tablets. The Talmud does not condemn him for this. Some rabbis say God agreed — the covenant could not be received by people not ready to receive it. There are moments when anger is the truthful response.",

        "In the Mahabharata, Joseph was sold into slavery by his own brothers out of jealousy. Years later, when his brothers came before him in Egypt not knowing who he was, he wept — not from weakness but from recognizing that the story had moved further than the wound. He chose differently.",

        "Proverbs 16:32 — 'One who is slow to anger is better than a warrior, and one who rules their spirit than one who captures a city.' The Hebrew tradition placed mastery of anger among the highest human achievements — not because the anger was wrong, but because the mastery was harder.",

        "A Talmudic story: a student came to his teacher enraged at being treated unfairly. The teacher said: 'Tell me the story three times.' Each time, the student told it, less of it was about injustice and more of it was about pain. By the third telling, they were talking about the pain.",
    ],

    tired: [
        "The Shabbat — the Jewish day of rest — is commanded alongside the greatest moral imperatives. Rest was not the absence of work; it was the crown of it. The world needed to be created first — and then it needed to be rested in.",

        "In the Book of Kings, the prophet Elijah — after a great victory — sat under a juniper tree and asked to die. He said: 'It is enough.' An angel came and touched him and said: 'Arise and eat — the journey is too great for you.' Not a lecture. Just: here is bread, here is water, sleep again.",

        "Jewish tradition tells of Miriam's Well — a miraculous spring said to follow the Israelites through the desert, appearing wherever songs were sung. Sometimes exhausted people need the reminder: the water is still near. You may need to sing before it appears.",

        "In many versions of the Golem legend, the Golem could not observe Shabbat — it did not know how to rest. This was considered its greatest limitation. Without rest, it could not be truly alive.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Culture registry
// ─────────────────────────────────────────────────────────────────────────────
type CultureKey = "indian" | "greek_roman" | "chinese" | "islamic_sufi" | "norse_slavic" | "japanese_zen" | "jewish";

const CULTURE_POOLS: Record<CultureKey, CulturePool> = {
    indian:       INDIAN,
    greek_roman:  GREEK_ROMAN,
    chinese:      CHINESE,
    islamic_sufi: ISLAMIC_SUFI,
    norse_slavic: NORSE_SLAVIC,
    japanese_zen: JAPANESE_ZEN,
    jewish:       JEWISH,
};

// Non-Indian cultures in a fixed cycle order for "other world" slot
const WORLD_CULTURES: readonly CultureKey[] = [
    "greek_roman", "chinese", "islamic_sufi", "norse_slavic", "japanese_zen", "jewish",
];

// Language → primary culture
// Indian languages + en + id → "indian" (id has deep Hindu/Buddhist cultural influence via Wayang)
const LANG_PRIMARY: Record<string, CultureKey> = {
    hi: "indian",  bn: "indian",  mr: "indian", ta: "indian", te: "indian",
    gu: "indian",  pa: "indian",  kn: "indian", ml: "indian", or: "indian",
    en: "indian",  id: "indian",
    ur: "islamic_sufi",
    ar: "islamic_sufi",
    zh: "chinese",
    es: "greek_roman", pt: "greek_roman",
    fr: "greek_roman", de: "greek_roman",
    ru: "norse_slavic",
    ja: "japanese_zen",
    he: "jewish",
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a contextually relevant mythology story for the given signal and language.
 *
 * Cultural priority:
 *   - Indian/Indonesian/English users: 70% Indian, 30% world (promotes Indian mythology)
 *   - Other users: 60% own culture, 35% Indian, 5% other world culture
 *
 * Frequency: ~1 in 6 emotional turns ((seed >>> 9) % 6 === 0)
 * Seed bit-window: >>>9 (avoids collision with storyEngine >>>7)
 *
 * Callers on rule-based offline paths apply an English-language gate before calling
 * (stories are in English).
 */
export function buildMythologyStory(
    signal: string,
    lang: string,
    seed: number,
): string | null {
    // ~1 in 6 turns
    if ((seed >>> 9) % 6 !== 0) return null;

    const primaryCulture = LANG_PRIMARY[lang] ?? "indian";
    const isIndianPrimary = primaryCulture === "indian";

    // Use bit-window 13 for culture selection (avoids collision with >>>9, >>>11)
    const cultureChoice = (seed >>> 13) % 10;

    let culture: CultureKey;
    if (isIndianPrimary) {
        // 70% Indian, 30% world — promotes Indian mythology globally
        if (cultureChoice < 7) {
            culture = "indian";
        } else {
            culture = WORLD_CULTURES[seed % WORLD_CULTURES.length]!;
        }
    } else {
        // 60% own culture, 35% Indian, 5% another world culture
        if (cultureChoice < 6) {
            culture = primaryCulture;
        } else if (cultureChoice < 9) {
            culture = "indian"; // promote Indian globally
        } else {
            const others = WORLD_CULTURES.filter(c => c !== primaryCulture);
            culture = others[seed % others.length]!;
        }
    }

    const pool = CULTURE_POOLS[culture][signal as MythSignal];
    if (!pool || pool.length === 0) {
        // Fallback to Indian
        const fallback = INDIAN[signal as MythSignal];
        if (!fallback || fallback.length === 0) return null;
        return fallback[seed % fallback.length]!;
    }

    return pool[seed % pool.length]!;
}
