(function (root) {
  'use strict';

  const VERSION = '2.2.0';

  const SOURCES = {
    britishLibrary: {
      label: 'British Library — collection overview',
      publisher: 'British Library',
      url: 'https://www.bl.uk/collection/explore-the-collection'
    },
    bibleSociety1804: {
      label: 'Bible Society — Mary Jones Walk history',
      publisher: 'Bible Society',
      url: 'https://www.biblesociety.org.uk/uploads/content/projects/mary_jones_walk_guide.pdf'
    },
    americanBibleSociety: {
      label: 'American Bible Society — About Us',
      publisher: 'American Bible Society',
      url: 'https://www.americanbible.org/about-us/'
    },
    ubsTranslation2025: {
      label: 'United Bible Societies — 2025 translation statistics',
      publisher: 'United Bible Societies',
      url: 'https://unitedbiblesocieties.org/100-languages-receive-bible-translations-in-2025-reaching-566-million-people-worldwide/'
    },
    ubsDistribution2025: {
      label: 'United Bible Societies — 2025 distribution statistics',
      publisher: 'United Bible Societies',
      url: 'https://unitedbiblesocieties.org/25-billion-scriptures-distributed-in-80-years-ubs-distribution-statistics-report-2025/'
    },
    ubsHow: {
      label: 'United Bible Societies — How we work',
      publisher: 'United Bible Societies',
      url: 'https://unitedbiblesocieties.org/how/'
    },
    wycliffeOral: {
      label: 'Wycliffe Global Alliance — Oral Bible Translation overview',
      publisher: 'Wycliffe Global Alliance',
      url: 'https://wycliffe.net/2025/09/16/obt-obs-whats-the-difference-2/'
    },
    silSign: {
      label: 'SIL Global — sign-language Bible translation',
      publisher: 'SIL Global',
      url: 'https://global.sil.org/stories-news/hidden-their-hearts/'
    }
  };

  const HISTORICAL_NOTES = [
    {
      id: 'manuscript-to-print',
      era: 'MANUSCRIPT → PRINT',
      title: 'Printing changed scale, not the need for careful text work.',
      body: 'Christian Scripture circulated in manuscript form for centuries before European movable-type printing. The Gutenberg Bible, dated to about 1455 in the British Library’s collection overview, became a landmark of that printing transition. WTTN compresses centuries of changing technologies into one producer ladder; Scribes and Scriptoria are therefore thematic anchors, not a literal chronology.',
      sourceIds: ['britishLibrary'],
      type: 'history'
    },
    {
      id: 'bible-society-movement',
      era: '1804 → 1816',
      title: 'Distribution became organized across durable institutions.',
      body: 'The British and Foreign Bible Society was founded in 1804, with the demand for affordable Welsh Bibles associated with stories such as Mary Jones helping inspire the movement. The American Bible Society followed in 1816. WTTN’s Network and Legacy layers borrow the idea that access depends on sustained publishing, distribution, partnerships, and institutional memory—not one heroic individual.',
      sourceIds: ['bibleSociety1804', 'americanBibleSociety'],
      type: 'history'
    },
    {
      id: 'translation-is-iterative',
      era: 'TRANSLATION PRACTICE',
      title: 'Bible translation is not simply “translate once and finish.”',
      body: 'Modern translation work includes first translations as well as new translations and revisions. Languages change, communities evaluate clarity and naturalness, and teams revisit earlier work. That is why WTTN treats Translation as repeated learning cycles rather than one irreversible conversion of a language into a resource.',
      sourceIds: ['ubsTranslation2025'],
      type: 'history'
    },
    {
      id: 'many-formats',
      era: 'ACCESS & FORMAT',
      title: 'Scripture access is broader than printed books.',
      body: 'Contemporary Bible work uses print alongside digital text, audio, Braille, and signed-language formats. United Bible Societies reports large digital and audio collections alongside printed distribution, while Deaf translation work produces visual Scripture in signed languages. WTTN’s Digital channel is therefore about format and logistical flexibility, not replacing embodied communities with technology.',
      sourceIds: ['ubsTranslation2025', 'ubsDistribution2025', 'silSign'],
      type: 'history'
    },
    {
      id: 'oral-translation',
      era: 'ORAL WORKFLOWS',
      title: 'Oral translation is translation, not a shortcut around quality.',
      body: 'Oral Bible Translation produces Scripture in spoken form and uses translation, checking, revision, and approval processes adapted for audio workflows. WTTN’s Oral Tradition Field exaggerates Project and Teacher importance to create a strategic challenge; it does not claim that real oral communities are simpler, harder, or less literate.',
      sourceIds: ['wycliffeOral'],
      type: 'history'
    },
    {
      id: 'distribution-multiple-channels',
      era: 'PRINT + DIGITAL',
      title: 'Distribution is a portfolio of channels, not one universal method.',
      body: 'Modern Bible distribution combines printed Scriptures with downloads, chapter views, audio, and other accessible formats. The balance differs by place and audience. WTTN turns that reality into four abstract channels so the player must make tradeoffs, but the percentages are game strategy—not claims about what any real community needs.',
      sourceIds: ['ubsDistribution2025', 'ubsHow'],
      type: 'history'
    }
  ];

  const LIBRARY_DETAILS = {
    torah: {
      lens: 'Formation before expansion',
      reflection: 'The Torah repeatedly binds hearing God’s word to remembering, teaching, covenant faithfulness, and ordinary life. WTTN begins here to remind the player that durable work starts with formation rather than scale.',
      questions: ['What must be remembered before it can be transmitted?', 'Which routines preserve faithfulness, and which merely increase activity?'],
      readingPath: ['Deuteronomy 6:4–9', 'Deuteronomy 17:18–20', 'Exodus 18:13–26'],
      gameBoundary: 'The producer ladder is not a model of Israel, covenant, or biblical authority. It only uses “foundations” as a campaign metaphor.'
    },
    history: {
      lens: 'Memory, reform, and honest records',
      reflection: 'The Historical Books preserve both faithfulness and failure. A campaign journal should therefore remember what actually happened rather than present every increase in capacity as proof that every decision was good.',
      questions: ['What did this campaign learn from failure?', 'What should be remembered so the next cycle does not begin from zero?'],
      readingPath: ['Joshua 4:1–7', '2 Kings 22:8–13', 'Nehemiah 8:1–8'],
      gameBoundary: 'Reset history is organizational memory, not a spiritual scorecard.'
    },
    wisdom: {
      lens: 'Skill under limits',
      reflection: 'Biblical wisdom values planning and skill while repeatedly exposing the limits of human control. WTTN’s statistics and presets are useful tools, but optimization is deliberately not the final meaning of the campaign.',
      questions: ['Where does planning help?', 'Where might efficiency become an idol rather than a servant?'],
      readingPath: ['Proverbs 15:22', 'Proverbs 21:5', 'Ecclesiastes 7:13–14'],
      gameBoundary: 'A mathematically optimal run is not presented as a morally superior run.'
    },
    prophets: {
      lens: 'Faithfulness is more than religious activity',
      reflection: 'The Prophets repeatedly resist the assumption that visible religious activity automatically equals obedience. Field constraints belong here because they interrupt comfortable routines and force the player to reconsider methods.',
      questions: ['What happens when familiar success metrics stop working?', 'Which forms of activity can hide deeper unfaithfulness?'],
      readingPath: ['Isaiah 55:8–11', 'Micah 6:6–8', 'Amos 5:21–24'],
      gameBoundary: 'Field penalties are game constraints; they do not represent divine judgment on real communities.'
    },
    gospels: {
      lens: 'Christ at the center',
      reflection: 'The Gospels prevent the campaign from making “reach” or institutional expansion its center. Christian mission flows from who Jesus is, what he has done, and his authority—not from the player accumulating infrastructure.',
      questions: ['What is the message being carried?', 'How does Jesus’ authority reshape ambition, service, and success?'],
      readingPath: ['Matthew 28:18–20', 'Luke 24:44–49', 'John 20:19–23'],
      gameBoundary: 'The campaign cannot simulate discipleship, conversion, baptism, the Spirit’s work, or obedience to Christ.'
    },
    acts: {
      lens: 'Witness through the Spirit, churches, and sent people',
      reflection: 'Acts presents witness crossing linguistic, social, and geographic boundaries through the Spirit’s work, local churches, persecution, hospitality, teaching, and costly travel. WTTN abstracts only a thin organizational slice of that picture.',
      questions: ['Who sends and supports workers?', 'How do local churches remain agents rather than targets of an external system?'],
      readingPath: ['Acts 1:8', 'Acts 2:5–11', 'Acts 13:1–4', 'Acts 14:21–28'],
      gameBoundary: 'Network Capacity is logistics—not apostolic authority, church health, or the Spirit’s power.'
    },
    epistles: {
      lens: 'Maturity, character, doctrine, shared responsibility',
      reflection: 'The Epistles repeatedly connect durable ministry with trustworthy teaching, qualified character, mutual service, endurance, and training others. WTTN’s Legacy system models only the continuity and training dimension.',
      questions: ['What deserves to be handed on?', 'What cannot be automated even when systems mature?'],
      readingPath: ['Ephesians 4:11–16', 'Philippians 1:3–7', '2 Timothy 2:1–7', 'Titus 2:1–8'],
      gameBoundary: 'Legacy points do not measure maturity in Christ, character, doctrine, or faithfulness.'
    },
    revelation: {
      lens: 'The nations gathered in worship, not completed by a progress bar',
      reflection: 'Revelation’s multinational vision places worship of God and the Lamb at the horizon. The campaign ending therefore refuses to say that people groups have been “finished,” conquered, or converted by the player.',
      questions: ['Who is at the center of the final vision?', 'How should the hope of the nations correct triumphalistic language?'],
      readingPath: ['Revelation 5:9–14', 'Revelation 7:9–12', 'Revelation 21:22–27'],
      gameBoundary: 'Completing WTTN means only that its designed systems and fictional campaign objectives are complete.'
    }
  };

  const FIELD_DETAILS = {
    urban: {
      focus: 'Many channels compete for attention.',
      abstraction: 'The allocation cap represents coordination pressure in a dense fictional context. It does not mean cities are spiritually more receptive, strategically superior, or reducible to network density.',
      reflection: 'Breadth can create opportunity and fragmentation at the same time. The challenge asks whether capacity can remain balanced rather than concentrating everything in one route.'
    },
    remote: {
      focus: 'Infrastructure is limited; recovery cannot rely on Local capacity.',
      abstraction: 'Distance and lower production model logistical friction only. Remote communities are not “behind,” less capable, or less important than urban ones.',
      reflection: 'The challenge shifts attention from speed to durable preparation and partnership when familiar infrastructure is unavailable.'
    },
    oral: {
      focus: 'Teaching and Projects matter more than direct written-output scaling.',
      abstraction: 'This Field borrows from oral-workflow ideas but does not represent a particular culture, literacy level, or language community. Real oral translation can involve rigorous checking and revision just as written translation does.',
      reflection: 'A method designed around text may need to change when the preferred medium is spoken or visual. Adaptation should serve understanding rather than force one communication form everywhere.'
    },
    restricted: {
      focus: 'Automation is temporarily constrained.',
      abstraction: 'The automation gate is a gameplay device. It does not simulate imprisonment, surveillance, violence, censorship, or the human cost of religious restriction.',
      reflection: 'Systems that are efficient in one context may be inappropriate or unavailable in another. The game represents that only as a return to deliberate manual decisions.'
    },
    multilingual: {
      focus: 'Translation requires more preparation but creates more learning.',
      abstraction: 'The higher threshold models coordination across languages. Language diversity is not treated as a defect to overcome; WTTN does not rank languages by value, complexity, or strategic importance.',
      reflection: 'Translation is service across difference. The reward is framed as learning gained through careful work, not the absorption of languages into one dominant system.'
    },
    'urban-ii': {
      focus: 'Balanced channels must remain viable across multiple cycles.',
      abstraction: 'This is a systems-integration challenge, not a claim that urban ministry should use fixed digital percentages.',
      reflection: 'Maturity means sustaining several complementary forms of work instead of maximizing one channel indefinitely.'
    },
    'remote-ii': {
      focus: 'Severe logistics expose how dependent the system has become on retained preparation.',
      abstraction: 'The production penalty is fictional and must not be read as a statement about poverty, rural life, geography, or missionary suffering.',
      reflection: 'The challenge asks which practices are truly foundational when familiar support structures are stripped back.'
    },
    'multilingual-ii': {
      focus: 'Several Translation cycles are needed while no single International route can dominate.',
      abstraction: 'This is a portfolio constraint, not a prescription for real multilingual work.',
      reflection: 'Cross-language work often requires repeated listening, revision, and local judgment. The game represents that patience through multiple cycles.'
    },
    'frontier-iii': {
      focus: 'Previously learned systems must work together under constraint.',
      abstraction: '“Frontier” is only a campaign label. Real unreached peoples are not levels, end bosses, targets, or difficulty tiers.',
      reflection: 'The final canonical Field tests adaptability rather than raw power: Projects, distribution, preparation, and reset timing all matter together.'
    },
    'mature-field': {
      focus: 'Mastered systems must remain adaptable rather than becoming automatic ritual.',
      abstraction: 'Repeatable Mature patterns are endgame exercises in already-learned mechanics. They do not imply that real mission contexts repeat predictably.',
      reflection: 'Experience should deepen judgment, not eliminate attention. The rotating patterns keep mature work from collapsing into one universal recipe.'
    }
  };

  const JOURNAL_DETAILS = {
    'small-beginnings': {
      category: 'WORK',
      memory: 'The campaign’s first meaningful objective was completed before any prestige currency existed.',
      reflection: 'Large systems begin with small acts of preparation. The journal records the step without pretending small beginnings guarantee large outcomes.'
    },
    'another-tongue': {
      category: 'TRANSLATION',
      memory: 'The first reset exchanged a temporary production build for permanent Translation learning.',
      reflection: 'Translation is represented as repeated learning and service across language difference, not as converting a language into points.'
    },
    'shared-work': {
      category: 'AUTOMATION',
      memory: 'Routine production became delegated so attention could move to decisions that still required judgment.',
      reflection: 'Delegation can serve faithfulness when it removes repetition without removing responsibility.'
    },
    'send-it-out': {
      category: 'NETWORK',
      memory: 'The campaign moved from producing material to sustaining channels through which prepared work could travel.',
      reflection: 'Distribution is not the same as reception, understanding, discipleship, or spiritual fruit.'
    },
    'new-context': {
      category: 'FIELD',
      memory: 'The first Mission Field broke the assumption that one optimized system should work everywhere.',
      reflection: 'Context should change methods without changing the worth of the people or communities involved.'
    },
    'many-contexts': {
      category: 'FIELD MASTERY',
      memory: 'All five Tier-I contexts were completed, proving that several different constraints could be handled without one universal build.',
      reflection: 'Breadth is useful only if it produces humility and adaptability rather than confidence that every context is now understood.'
    },
    'faithful-over-time': {
      category: 'LEGACY',
      memory: 'Enough methods and infrastructure had become durable that a larger reset could preserve meaningful organizational memory.',
      reflection: 'The game calls this Legacy, but biblical faithfulness is not inherited automatically through institutions or measured by continuity.'
    },
    'canonical-map': {
      category: 'FIELD MASTERY',
      memory: 'All nine canonical fictional Fields were cleared, while Mature Fields remained as repeatable exercises in adaptation.',
      reflection: 'A completed campaign map is not a claim that the world, missions, or any real people group has been completed.'
    },
    'library-open': {
      category: 'SCRIPTURE LIBRARY',
      memory: 'Every canonical collection in the game’s reading structure became available.',
      reflection: 'The Library points outward to Scripture itself. Unlocking a card is not equivalent to reading, understanding, believing, or obeying the text.'
    },
    'to-every-nation': {
      category: 'CAMPAIGN',
      memory: 'The designed progression concluded after canonical Field mastery, a complete Mature cycle, and accumulated Legacy.',
      reflection: 'The final title echoes the Great Commission, but the campaign ends with a refusal to quantify conversion or declare real mission work finished.'
    }
  };

  const GUARDRAILS = [
    { title: 'Salvation is not simulated', body: 'No resource represents conversion, regeneration, justification, baptism, eternal destiny, or the Spirit’s work.' },
    { title: 'Prayer is not a currency', body: 'Prayer is never spent, accumulated, automated, or converted into production.' },
    { title: 'People are never output', body: 'WTTN does not count souls, people reached, churches planted, disciples made, or people groups completed.' },
    { title: 'Access is not engagement', body: 'Producing or distributing Scripture does not mean that anyone has read, understood, believed, or obeyed it.' },
    { title: 'Cultures are not difficulty tiers', body: 'Mission Fields are fictional strategic abstractions. Their penalties do not rank real cultures, languages, places, or communities.' },
    { title: 'Efficiency is not faithfulness', body: 'A faster campaign, optimal build, or stronger institution is not presented as evidence of greater obedience, holiness, or divine favor.' },
    { title: 'Suffering is not a mechanic to trivialize', body: 'Restricted and remote Fields deliberately avoid pretending to simulate persecution, poverty, danger, displacement, or missionary suffering.' },
    { title: 'Mission belongs to God', body: 'The game models human stewardship around Scripture while refusing to portray mission as a project that human systems control or complete.' }
  ];

  const REVIEW = {
    reviewedVersion: VERSION,
    principles: [
      'Keep Christ and Scripture central while treating the economy as an abstraction of human stewardship only.',
      'Prefer local agency, partnership, listening, and adaptation language over conquest, targeting, or cultural superiority language.',
      'Separate historical description from theological claims and from fictional game abstractions.',
      'Avoid prosperity logic: more capacity does not imply greater divine approval.',
      'Avoid quantifying spiritual fruit or implying that access to Scripture guarantees engagement or conversion.',
      'Use mission terminology carefully around restriction, oral communication, remoteness, multilingual contexts, and unreached peoples.'
    ]
  };

  root.WTTNContentDepth = {
    VERSION,
    SOURCES,
    HISTORICAL_NOTES,
    LIBRARY_DETAILS,
    FIELD_DETAILS,
    JOURNAL_DETAILS,
    GUARDRAILS,
    REVIEW
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
