(function (root) {
  'use strict';

  const CONTENT_VERSION = '2.2.0';

  const INTRO = {
    premise: 'Word to the Nations is an incremental game about the human work around Scripture: preparing texts, learning, teaching, translating, organizing distribution, adapting methods, and building durable capacity. The numbers model stewardship and infrastructure—not spiritual worth, salvation, or people.',
    scriptureNote: 'Scripture references are invitations to read the passages in the Bible translation you use. References do not grant numerical bonuses and are not treated as consumable rewards.',
    missionNote: 'Mission Fields are fictionalized strategic contexts. Their rules are game abstractions, not judgments about real cultures, countries, churches, or people groups. Real churches, translators, and communities are agents with their own knowledge and responsibility—not targets owned by an outside system.'
  };

  const PRODUCERS = {
    scribe: {
      description: 'Careful hands begin the work one page at a time. Scribes represent patient preparation, copying, and textual care.',
      references: ['Ezra 7:10', 'Jeremiah 36:4']
    },
    copyist: {
      description: 'Repeatable methods let careful work spread beyond a single desk without abandoning accuracy.',
      references: ['Deuteronomy 17:18–19']
    },
    editor: {
      description: 'Editors compare, organize, and clarify the work so that what is taught can be handled responsibly.',
      references: ['Nehemiah 8:8', '2 Timothy 2:15']
    },
    teacher: {
      description: 'Teachers turn prepared material into patient instruction. In this game they represent teaching capacity, not spiritual rank.',
      references: ['2 Timothy 2:2', 'James 3:1']
    },
    workshop: {
      description: 'A workshop coordinates people, tools, schedules, and repeatable processes around the same shared task.',
      references: ['1 Corinthians 12:4–7']
    },
    scriptorium: {
      description: 'A mature center preserves methods, trains others, and sustains Scripture work beyond one person or one season.',
      references: ['2 Timothy 2:2', 'Psalm 145:4']
    }
  };

  const METHODS = {
    desk: { description: 'Order the basic work so attention can remain on the text rather than avoidable friction.', references: ['1 Corinthians 14:40'] },
    copying: { description: 'Develop a repeatable copying process that increases capacity without changing the message.', references: ['Deuteronomy 17:18–19'] },
    editorial: { description: 'Use consistent review practices so preparation is careful, intelligible, and accountable.', references: ['Nehemiah 8:8'] },
    teaching: { description: 'Build a framework for explaining what has been prepared clearly and faithfully.', references: ['2 Timothy 2:2', 'Titus 2:1'] },
    workshopCoord: { description: 'Coordinate many contributors without making the work depend on one person.', references: ['1 Corinthians 12:12–20'] },
    reference: { description: 'Reference shelves support closer comparisons of how buildings and commissions work together. Essential requirements are always visible.', references: ['Luke 14:28'] },
    shared: { description: 'Share proven methods across the whole operation instead of keeping knowledge isolated.', references: ['Philippians 4:9'] },
    translationPrep: { description: 'Prepare terminology, references, workflows, and review capacity before larger translation work begins.', references: ['Luke 14:28', 'Proverbs 15:22'] }
  };

  const PROJECTS = {
    manuscript: {
      description: 'Set aside current output to complete a focused manuscript-preparation effort. The immediate sacrifice improves the rest of this run.',
      references: ['Jeremiah 36:27–32']
    },
    reference: {
      description: 'Build shared references and review conventions so different parts of the work reinforce one another.',
      references: ['Nehemiah 8:8']
    },
    teaching: {
      description: 'Bring prepared material together into a coherent teaching collection once the earlier work is established.',
      references: ['2 Timothy 2:2', 'Acts 18:24–26']
    }
  };

  const TRANSLATION = {
    layer: {
      title: 'Translation Practice',
      description: 'A completed Translation represents finishing a major language-work cycle and carrying its learned methods into the next. Translation Insight models accumulated technical knowledge and experience—not the value of Scripture itself.',
      references: ['Acts 2:5–11', 'Acts 8:30–35', 'Revelation 7:9–10']
    },
    repeatables: {
      workflow: { description: 'Refine repeatable working methods so the same team can prepare more material with less friction.', references: ['1 Corinthians 14:40'] },
      training: { description: 'Invest in people who can strengthen the work of others rather than only increasing individual output.', references: ['2 Timothy 2:2'] },
      preparation: { description: 'Retain solved setup work between Translation cycles. Maturity should remove repetition, not erase meaningful decisions.', references: ['Proverbs 24:27'] }
    },
    oneTimes: {
      standardTerminology: { description: 'Record terminology consistently so later decisions can be compared instead of repeatedly rediscovered.', references: ['1 Corinthians 14:9'] },
      reusableTemplates: { description: 'Preserve useful working structures from earlier Translation cycles.', references: ['2 Timothy 1:13–14'] },
      consistentWorkflow: { description: 'Measure whether a reset is actually fruitful instead of resetting simply because it is possible.', references: ['Luke 14:28'] },
      buyMax: { description: 'Remove repetitive purchasing once the underlying decision has been learned.', references: ['Exodus 18:17–23'] },
      basicAutomation: { description: 'Delegate routine early work so attention can move to decisions that still require judgment.', references: ['Exodus 18:21–23'] },
      fullAutomation: { description: 'Automate the mature base production chain while retaining oversight of higher-level decisions.', references: ['Acts 6:1–4'] },
      projectQueue: { description: 'Let established Projects proceed automatically when their requirements are met.', references: ['1 Corinthians 14:40'] },
      presets: { description: 'Save working configurations so learned strategy becomes reusable organizational memory.', references: ['Philippians 3:16'] },
      translationAutomation: { description: 'Automate reset timing under explicit rules. Automation follows the same readiness constraints as manual Translation.', references: ['Proverbs 21:5'] }
    },
    specializations: {
      scholar: { description: 'Favor longer study-oriented cycles, careful preparation, stronger Project work, and a small late-run Translation Insight dividend.', references: ['Ezra 7:10', 'Acts 17:11'] },
      publisher: { description: 'Favor rapid recovery, repeatable production, and faster Translation-readiness cycles without increasing the raw prestige formula.', references: ['Habakkuk 2:2'] },
      teacher: { description: 'Favor milestone development, easier Projects, and a modest Translation Insight dividend once Projects are completed.', references: ['2 Timothy 2:2'] }
    }
  };

  const NETWORK = {
    layer: {
      description: 'Network Capacity represents logistics, partnerships, continuity, and channels through which prepared Scripture work can travel. It does not count converts, churches, or people reached.',
      references: ['Romans 10:14–15', '3 John 1:5–8']
    },
    channels: {
      local: { description: 'Strengthen nearby recovery and dependable local support. Its effect is strongest early in a Network cycle and lasts slightly longer when paired with Regional capacity.', references: ['Acts 2:42–47'] },
      regional: { description: 'Build steady regional coordination that supports sustained Page production and pairs with both Local recovery and Digital Project work.', references: ['Acts 9:31'] },
      international: { description: 'Invest in cross-language and cross-boundary distribution, improving Translation Insight rather than human outcomes. Digital capacity strengthens this bridge slightly.', references: ['Acts 13:47', 'Romans 15:20–21'] },
      digital: { description: 'Use digital channels to reduce logistical friction around Projects and reusable material, with additional synergy from Regional and International capacity.', references: ['Psalm 96:3'] }
    },
    upgrades: {
      infrastructure: { description: 'Develop finite, durable infrastructure that strengthens lower-layer work without becoming an unlimited growth loop.', references: ['Nehemiah 2:17–18'] },
      distributionNotes: { description: 'Record distribution configurations so useful allocation patterns can be reused.', references: ['Proverbs 21:5'] },
      localPartnership: { description: 'Begin future cycles with established local working capacity rather than rebuilding from nothing.', references: ['Philippians 1:3–5'] },
      persistentWorkflow: { description: 'Carry mature purchasing tools through Network resets.', references: ['Philippians 3:16'] },
      trainingContinuity: { description: 'Preserve a basic level of preparation when the larger Network is rebuilt.', references: ['2 Timothy 2:2'] },
      coordinatedMethods: { description: 'Retain the earliest Project as solved organizational knowledge.', references: ['1 Corinthians 14:40'] },
      persistentAutomation: { description: 'Keep routine Project operations automated once the Network has learned them.', references: ['Acts 6:1–4'] },
      translationContinuity: { description: 'Preserve Translation automation through Network resets once reset timing is a solved problem.', references: ['Proverbs 21:5'] },
      parallelProjects: { description: 'Coordinate several established Projects without forcing them through an artificial queue.', references: ['1 Corinthians 12:4–7'] },
      matureNetwork: { description: 'Begin a new Network cycle with a small base of accumulated Translation Insight.', references: ['Philippians 3:16'] }
    }
  };

  const FIELDS = {
    urban: {
      narrative: 'A dense setting offers many channels but punishes over-concentration. The challenge is coordination rather than raw output.',
      references: ['Acts 17:16–34'],
      caution: 'This is a fictional strategy archetype, not a description of every city or urban ministry.'
    },
    remote: {
      narrative: 'Distance and limited infrastructure reduce throughput. Progress depends on patient preparation rather than assuming local capacity is immediately available.',
      references: ['Acts 8:26–40'],
      caution: 'The rule models logistical constraint only; it does not imply anything about the spiritual condition or value of rural communities.'
    },
    oral: {
      narrative: 'Direct written-output systems are less dominant, while teaching and completed Projects matter more. The challenge asks you to adapt the method instead of assuming literacy-centered workflows always fit.',
      references: ['Romans 10:17', '2 Timothy 2:2'],
      caution: '“Oral Tradition” is a gameplay archetype about communication mode, not a judgment on any specific culture.'
    },
    restricted: {
      narrative: 'Routine automation is constrained, so deliberate reset decisions return to the foreground for part of the cycle.',
      references: ['Acts 4:18–31', 'Colossians 4:3–4'],
      caution: 'The game does not attempt to simulate persecution, legal risk, or the lived cost of ministry under restriction.'
    },
    multilingual: {
      narrative: 'Translation work takes substantially more preparation, but successful cycles produce more accumulated insight.',
      references: ['Acts 2:5–11', 'Revelation 7:9–10'],
      caution: 'Language diversity is treated as a design constraint and gift, not as a problem to eliminate.'
    },
    'urban-ii': {
      narrative: 'A more mature urban challenge requires balanced distribution and meaningful digital capacity over multiple Network cycles.',
      references: ['Acts 19:8–10']
    },
    'remote-ii': {
      narrative: 'Severe infrastructure limits force the system to operate with reduced preparation and very little Local allocation.',
      references: ['2 Corinthians 11:26–28'],
      caution: 'The numerical hardship is abstract and should not be read as a representation of real missionary suffering.'
    },
    'multilingual-ii': {
      narrative: 'A deeper multilingual setting stretches Translation thresholds while limiting reliance on one International channel.',
      references: ['Genesis 11:1–9', 'Acts 2:5–11', 'Revelation 7:9–10']
    },
    'frontier-iii': {
      narrative: 'The final canonical Field combines constraints from across the campaign. Mastery means adapting the whole system without bypassing its core Projects.',
      references: ['Romans 15:20–21', 'Matthew 28:18–20'],
      caution: '“Frontier” is used as a game-system label for a difficult unrepeated context, not to reduce real unreached peoples to a difficulty tier.'
    },
    'mature-field': {
      narrative: 'Canonical challenges are complete. Mature Fields now rotate through recovery, Translation, distribution, and integration patterns so continued work requires different forms of already-mastered judgment rather than one repeated template.',
      references: ['1 Corinthians 15:58', 'Galatians 6:9']
    }
  };

  const LEGACY = {
    layer: {
      description: 'Legacy represents durable organizational memory: trained people, documented methods, retained infrastructure, and continuity across generations of work. Repeat Legacy eras mature over time, so very short eras receive compressed rewards instead of becoming a reset-spam loop. Legacy does not measure holiness, faithfulness before God, or spiritual fruit.',
      references: ['Psalm 145:4', '2 Timothy 2:2']
    },
    traditions: {
      translation: { description: 'Lean into long-cycle language work: preserve Preparation, strengthen your Translation specialization, and mature repeat Translation readiness sooner.', references: ['Ezra 7:10'] },
      teaching: { description: 'Lean into structured formation: strengthen producer milestones and completed Project work, especially in integrated Mature cycles.', references: ['2 Timothy 2:2'] },
      distribution: { description: 'Lean into route stewardship: preserve Network infrastructure and strengthen the bounded synergies between distribution channels.', references: ['Romans 10:14–15'] },
      pioneer: { description: 'Lean into Field continuity: reduce Field thresholds and remove unrelated fresh-NC preparation after the first Legacy while preserving Field objectives.', references: ['Romans 15:20–21'] }
    },
    milestones: {
      foundationalMethods: { description: 'Basic Page methods have become organizational memory rather than work that must be rediscovered.', references: ['Philippians 3:16'] },
      projectsVisible: { description: 'Projects are known from the beginning of each Legacy cycle.', references: ['Psalm 78:5–7'] },
      buyMax: { description: 'Unfinished purchasing plans are carried into the next Legacy and Field.', references: ['Exodus 18:21–23'] },
      specializationRetained: { description: 'Your established Translation specialization survives the next Legacy reset.', references: ['Philippians 3:16'] },
      automation: { description: 'Base production automation is now permanent organizational infrastructure.', references: ['Acts 6:1–4'] },
      translationUnlocked: { description: 'Early Translation development begins partially restored.', references: ['2 Timothy 2:2'] },
      firstTranslationCompressed: { description: 'Begin recovery with a small reserve of Translation Insight from established practice.', references: ['Proverbs 22:29'] },
      networkPresets: { description: 'Distribution configurations are retained as institutional memory.', references: ['Proverbs 21:5'] },
      networkRecovery: { description: 'Legacy increasingly compresses Network recovery without erasing Network decisions.', references: ['Psalm 145:4'] },
      fieldRetention: { description: 'Entering the next Field no longer requires rebuilding unrelated outside-Field capacity.', references: ['2 Timothy 2:2'] },
      finalSequence: { description: 'The designed campaign can conclude once canonical Field mastery, 100 lifetime Legacy, and one complete four-pattern Mature cycle are all demonstrated.', references: ['Matthew 28:18–20', 'Revelation 7:9–10'] }
    }
  };

  const LIBRARY = {
    torah: {
      summary: 'Beginnings, covenant, instruction, and the formation of a people ordered around God’s word.',
      references: ['Deuteronomy 6:4–9', 'Deuteronomy 17:18–20'],
      campaignRole: 'Foundations & progression ledger'
    },
    history: {
      summary: 'Remembered acts, failures, reforms, and the importance of transmitting faithful memory rather than starting from zero.',
      references: ['Joshua 4:1–7', 'Nehemiah 8:1–8'],
      campaignRole: 'History & records'
    },
    wisdom: {
      summary: 'Skill, discernment, planning, patience, and the limits of merely accumulating activity.',
      references: ['Proverbs 15:22', 'Proverbs 21:5', 'Ecclesiastes 7:12'],
      campaignRole: 'Statistics & presets'
    },
    prophets: {
      summary: 'God’s word confronts complacency, calls for faithfulness, and refuses to let religious activity substitute for obedience.',
      references: ['Isaiah 55:10–11', 'Micah 6:8'],
      campaignRole: 'Field constraints'
    },
    gospels: {
      summary: 'The campaign’s center is not expansion itself but Jesus Christ, his kingdom, his teaching, his death and resurrection, and his commission.',
      references: ['Matthew 28:18–20', 'Luke 24:44–49', 'John 20:21'],
      campaignRole: 'Campaign milestones'
    },
    acts: {
      summary: 'Witness crosses languages and boundaries through the Spirit’s work, local churches, sent workers, teaching, and costly perseverance.',
      references: ['Acts 1:8', 'Acts 2:5–11', 'Acts 13:1–3'],
      campaignRole: 'Mission systems & automation'
    },
    epistles: {
      summary: 'Mature ministry requires doctrine, character, shared responsibility, endurance, and the training of others.',
      references: ['2 Timothy 2:2', 'Ephesians 4:11–16', 'Philippians 1:3–5'],
      campaignRole: 'Traditions & synergy'
    },
    revelation: {
      summary: 'The biblical horizon is not a progress bar completed by human effort, but worship before God from every nation, tribe, people, and language.',
      references: ['Revelation 5:9–10', 'Revelation 7:9–12'],
      campaignRole: 'Final sequence'
    }
  };

  const ACHIEVEMENTS = [
    { id: 'small-beginnings', name: 'Small Beginnings', description: 'Complete your first Project.', reference: 'Zechariah 4:10', condition: 'firstProject' },
    { id: 'another-tongue', name: 'Into Another Tongue', description: 'Complete your first Translation.', reference: 'Acts 2:5–11', condition: 'firstTranslation' },
    { id: 'shared-work', name: 'Shared Work', description: 'Unlock Full Production Automation.', reference: 'Acts 6:1–4', condition: 'fullAutomation' },
    { id: 'send-it-out', name: 'Send It Out', description: 'Establish your first Network.', reference: 'Romans 10:14–15', condition: 'firstNetwork' },
    { id: 'new-context', name: 'A New Context', description: 'Complete your first Mission Field.', reference: 'Acts 13:2–4', condition: 'firstField' },
    { id: 'many-contexts', name: 'Across Boundaries', description: 'Complete all five Tier-I Fields.', reference: 'Acts 1:8', condition: 'tier1' },
    { id: 'faithful-over-time', name: 'Faithful Over Time', description: 'Establish your first Legacy.', reference: '2 Timothy 2:2', condition: 'firstLegacy' },
    { id: 'canonical-map', name: 'The Whole Campaign Map', description: 'Complete all nine canonical Mission Fields.', reference: 'Romans 15:20–21', condition: 'allFields' },
    { id: 'library-open', name: 'Open the Library', description: 'Unlock all Scripture Library collections.', reference: 'Luke 24:27', condition: 'allLibrary' },
    { id: 'to-every-nation', name: 'To Every Nation', description: 'Complete the designed campaign.', reference: 'Matthew 28:18–20', condition: 'campaignComplete' }
  ];

  const TERMINOLOGY = {
    Pages: 'Prepared Scripture-work output: manuscripts, layouts, teaching material, and related production.',
    TI: 'Translation Insight: accumulated technical and organizational learning from completed Translation cycles.',
    NC: 'Network Capacity: logistics, partnerships, infrastructure, and distribution capability.',
    FE: 'Field Experience: practical learning gained by completing constrained Mission Field scenarios.',
    Legacy: 'Durable organizational memory and continuity. It is explicitly not a measure of spiritual merit.'
  };

  root.WTTNContent = {
    CONTENT_VERSION,
    INTRO,
    PRODUCERS,
    METHODS,
    PROJECTS,
    TRANSLATION,
    NETWORK,
    FIELDS,
    LEGACY,
    LIBRARY,
    ACHIEVEMENTS,
    TERMINOLOGY
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
