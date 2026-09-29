(function (root, factory) {
  const math = typeof require === 'function' && typeof module === 'object' && module.exports
    ? require('./bignum.js')
    : root.WTTNMath;
  const api = factory(math);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WTTNCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function ({ BigNum, bn, piecewiseLogCost, softcap }) {
  const VERSION = 8;
  const TRANSLATION_THRESHOLD = bn('1e12');
  const TRANSLATION_EXPONENT = 0.65;
  const SPECIALIZATION_UNLOCK_LIFETIME_TI = bn(100);
  const PHASE2_MASTERY_LIFETIME_TI = bn(250);
  const NETWORK_BASE_THRESHOLD = bn(1200);
  const FIELD_UNLOCK_LIFETIME_NC = bn(4);
  const LEGACY_UNLOCK_FE = bn(70);
  const LEGACY_EXPONENT = 0.60;
  const LEGACY_SCALE = 15.5;
  const LEGACY_READINESS_TARGET_SECONDS = 30 * 3600;
  const CAMPAIGN_LEGACY_TARGET = bn(100);
  const FIELD_REWARD_SCALE = 20;

  const PRODUCERS = [
    { id: 'scribe', name: 'Scribe', baseLog10: 1, ratio: 1.14, production: 1, qStart: 150, q: 0.00035, cStart: 500, c: 2e-7, description: 'Copies and prepares individual pages.' },
    { id: 'copyist', name: 'Copyist', baseLog10: 2, ratio: 1.15, production: 12, qStart: 130, q: 0.00040, cStart: 450, c: 2.5e-7, description: 'Produces pages at a larger, repeatable scale.' },
    { id: 'editor', name: 'Editor', baseLog10: 4, ratio: 1.16, production: 600, qStart: 110, q: 0.00050, cStart: 400, c: 3e-7, description: 'Improves and coordinates the work below.' },
    { id: 'teacher', name: 'Teacher', baseLog10: 6, ratio: 1.17, production: 30000, qStart: 90, q: 0.00065, cStart: 350, c: 4e-7, description: 'Turns prepared material into structured teaching work.' },
    { id: 'workshop', name: 'Workshop', baseLog10: 8, ratio: 1.18, production: 2000000, qStart: 75, q: 0.00080, cStart: 300, c: 5e-7, description: 'Coordinates a larger production operation.' },
    { id: 'scriptorium', name: 'Scriptorium', baseLog10: 11, ratio: 1.20, production: 1000000000, qStart: 60, q: 0.00100, cStart: 250, c: 7e-7, description: 'A mature center for sustained Scripture work.' }
  ];

  const PAGE_UPGRADES = [
    { id: 'desk', name: 'Organized Desk', cost: '1e3', target: 'scribe', mult: 2, description: 'Scribes ×2.' },
    { id: 'copying', name: 'Copying Methods', cost: '2e3', target: 'copyist', mult: 2, description: 'Copyists ×2.' },
    { id: 'editorial', name: 'Editorial Standards', cost: '5e4', target: 'editor', mult: 2, description: 'Editors ×2.' },
    { id: 'teaching', name: 'Teaching Framework', cost: '1e6', target: 'teacher', mult: 2, description: 'Teachers ×2.' },
    { id: 'workshopCoord', name: 'Coordinated Workshop', cost: '5e7', target: 'workshop', mult: 2, description: 'Workshops ×2.' },
    { id: 'reference', name: 'Reference System', cost: '1e9', utility: true, description: 'Unlocks detailed Project progress. No direct production multiplier.' },
    { id: 'shared', name: 'Shared Methods', cost: '1e10', globalMult: 2, description: 'All producers ×2.' },
    { id: 'translationPrep', name: 'Translation Preparation', cost: '1e11', globalMult: 3, description: 'All producers ×3.' }
  ];

  const PROJECTS = [
    { id: 'manuscript', name: 'Manuscript Project', peak: '1e6', description: 'Invest 20% of current Pages. Current run production ×1.5.' },
    { id: 'reference', name: 'Reference Project', peak: '1e9', editors: 25, description: 'Reach 25 Editors. Strengthens producer synergy.' },
    { id: 'teaching', name: 'Teaching Collection', peak: '1e10', teachers: 25, requires: ['manuscript', 'reference'], description: 'Reach 25 Teachers after both earlier Projects. Current run production ×2.' }
  ];

  const TI_REPEATABLES = [
    { id: 'workflow', name: 'Workflow', baseCost: 1, costGrowth: 4, effectGrowth: 1.45, description: 'All Page production ×1.45 per level.' },
    { id: 'training', name: 'Training', baseCost: 3, costGrowth: 5, description: 'Strengthens producer synergy by 8% per level.' },
    { id: 'preparation', name: 'Preparation', fixedCosts: [5, 15, 45, 135, 405, 1215], maxLevel: 6, description: 'Compresses solved early-run setup through retained starting conditions.' }
  ];

  const TI_ONE_TIMES = [
    { id: 'standardTerminology', name: 'Standard Terminology', cost: 5, description: 'Unlock detailed Translation gain diagnostics.' },
    { id: 'reusableTemplates', name: 'Reusable Templates', cost: 10, requires: 'standardTerminology', description: 'Unlock recent-run comparison in Translation.' },
    { id: 'consistentWorkflow', name: 'Consistent Workflow', cost: 20, requires: 'reusableTemplates', description: 'Unlock reset-efficiency guidance.' },
    { id: 'basicAutomation', name: 'Basic Automation', cost: 25, requires: 'consistentWorkflow', description: 'Unlock reserve-aware Scribe and Copyist automation. It starts paused; enable Base Automation when you want it to run.' },
    { id: 'fullAutomation', name: 'Full Production Automation', cost: 50, requires: 'basicAutomation', description: 'Extend Base Automation to all economic producers and Methods while respecting planned purchases and near-term Translation boundaries.' },
    { id: 'projectQueue', name: 'Project Queue', cost: 75, requires: 'fullAutomation', description: 'Unlock automatic Project completion. It starts paused; enable Project Automation when you want it to run.' },
    { id: 'presets', name: 'Translation Presets', cost: 100, requires: 'projectQueue', description: 'Save and load Translation specialization and auto-reset settings.' },
    { id: 'translationAutomation', name: 'Translation Automation', cost: 150, requires: 'presets', description: 'Unlock automatic Translation using configurable reset rules. It starts paused so purchasing it can never reset the current run.' }
  ];

  const SPECIALIZATIONS = [
    { id: 'scholar', name: 'Scholar', description: 'Long-cycle specialization. After 10 minutes, Page production ramps toward ×1.5; Project effects are 20% stronger; after 20 minutes, a bounded TI dividend gradually rises toward ×1.10.' },
    { id: 'publisher', name: 'Publisher', description: 'Fast-cycle specialization. Producer base costs ×0.75, the first 100 of each producer cost another ×0.90, and repeat Translation readiness matures 15% sooner.' },
    { id: 'teacher', name: 'Teacher', description: 'Milestone specialization. Producer milestones ×1.15, Project thresholds are 20% lower, and completed Projects add up to a bounded ×1.09 TI curriculum bonus.' }
  ];

  const NETWORK_UPGRADES = [
    { id: 'infrastructure', name: 'Infrastructure', repeatable: true, maxLevel: 12, baseCost: 2, costGrowth: 5, effectGrowth: 1.35, description: 'All Page production ×1.35 per level. Maximum 12 levels.' },
    { id: 'distributionNotes', name: 'Distribution Notes', cost: 3, description: 'Unlock Distribution presets.' },
    { id: 'localPartnership', name: 'Local Partnership', cost: 8, description: 'Every Translation run starts with at least 25 Scribes and 10 Copyists.' },
    { id: 'persistentWorkflow', name: 'Persistent Workflow', cost: 20, description: 'Unfinished purchasing orders survive Network resets.' },
    { id: 'trainingContinuity', name: 'Training Continuity', cost: 50, description: 'Network resets retain at least Preparation Lv2.' },
    { id: 'coordinatedMethods', name: 'Coordinated Methods', cost: 125, description: 'Manuscript Project begins completed after resets.' },
    { id: 'persistentAutomation', name: 'Persistent Automation', cost: 300, description: 'Project automation survives Network resets; base producer automation is already permanent after the first Network.' },
    { id: 'translationContinuity', name: 'Translation Continuity', cost: 750, description: 'Auto-Translation survives Network resets.' },
    { id: 'parallelProjects', name: 'Parallel Projects', cost: 1500, description: 'Project automation can process every eligible Project in one pass.' },
    { id: 'matureNetwork', name: 'Mature Network', cost: 5000, description: 'Begin each Network cycle with 10 Translation Insight.' }
  ];

  const FIELDS = [
    {
      id: 'urban', name: 'Urban Hub I', tier: 1, ncThreshold: 2, difficulty: 1.0,
      allocationCap: 0.40, objective: { validNetworks: 1 }, reward: 'allocationCap',
      description: 'Dense infrastructure, but distribution must stay balanced. No channel may exceed 40%.',
      rewardText: 'Normal allocation cap increases from 70% to 75%.'
    },
    {
      id: 'remote', name: 'Remote Region I', tier: 1, ncThreshold: 3, difficulty: 1.1,
      pageMultiplier: 0.60, localCap: 0.20, objective: { validNetworks: 1 }, reward: 'preparationBoost',
      description: 'Lower infrastructure slows Page work. Local allocation is capped at 20%.',
      rewardText: 'Field resets grant +1 effective Preparation level.'
    },
    {
      id: 'oral', name: 'Oral Tradition I', tier: 1, ncThreshold: 4, difficulty: 1.2,
      directProducerMultiplier: 0.70, teacherMultiplier: 2, projectMultiplier: 2,
      objective: { validNetworks: 1 }, reward: 'firstProjectRetained',
      description: 'Direct production is weaker, while Teachers and completed Projects matter much more.',
      rewardText: 'Manuscript Project is retained after future Field resets.'
    },
    {
      id: 'restricted', name: 'Restricted Context I', tier: 1, ncThreshold: 5, difficulty: 1.35,
      pageMultiplier: 0.82, autoTranslationTiGate: 1000,
      objective: { validNetworks: 1 }, reward: 'persistentAutomation',
      description: 'Automatic Translation stays disabled until 1,000 TI are earned in the current Network cycle.',
      rewardText: 'Project automation survives future Field resets.'
    },
    {
      id: 'multilingual', name: 'Multilingual Crossroads I', tier: 1, ncThreshold: 6, difficulty: 1.5,
      translationThresholdMultiplier: 10, tiMultiplier: 1.5,
      objective: { validNetworks: 1, translations: 3 }, reward: 'internationalBonus',
      description: 'Translations require 10× more peak Pages, but completed work yields 1.5× TI.',
      rewardText: 'International distribution becomes 15% more effective.'
    },
    {
      id: 'urban-ii', name: 'Urban Hub II', tier: 2, ncThreshold: 10, difficulty: 2.0, requiresField: 'urban',
      pageMultiplier: 0.75, allocationCap: 0.40, digitalMin: 0.20,
      objective: { validNetworks: 2 }, reward: 'regionalBonus',
      description: 'Balanced allocation remains mandatory and Digital must receive at least 20%.',
      rewardText: 'Regional distribution becomes 10% more effective.'
    },
    {
      id: 'remote-ii', name: 'Remote Region II', tier: 2, ncThreshold: 15, difficulty: 2.3, requiresField: 'remote',
      pageMultiplier: 0.50, localCap: 0.10, preparationCap: 3,
      objective: { validNetworks: 2 }, reward: 'networkStart',
      description: 'Page production is halved, Local is capped at 10%, and effective Preparation cannot exceed Lv3.',
      rewardText: 'Future Field cycles begin with at least 2 NC.'
    },
    {
      id: 'multilingual-ii', name: 'Multilingual Crossroads II', tier: 2, ncThreshold: 20, difficulty: 2.6, requiresField: 'multilingual',
      translationThresholdMultiplier: 25, tiMultiplier: 1.4, internationalCap: 0.40,
      objective: { validNetworks: 2, translations: 5 }, reward: 'internationalBonusII',
      description: 'Translations require 25× peak Pages and International allocation is capped at 40%.',
      rewardText: 'International distribution gains another 10% effectiveness.'
    },
    {
      id: 'frontier-iii', name: 'Frontier III', tier: 3, ncThreshold: 35, difficulty: 4.0,
      pageMultiplier: 0.45, allocationCap: 0.40, autoTranslationTiGate: 2500, preparationCap: 2,
      requireAllProjects: true, objective: { validNetworks: 3, translations: 8 }, reward: 'fieldCompression',
      description: 'A full-system test: weak production, balanced allocation, restricted automation, low Preparation, and all Projects required.',
      rewardText: 'Future Field thresholds are reduced by 10%.'
    }
  ];

  const MATURE_FIELD = {
    id: 'mature-field', name: 'Mature Field', tier: 3, ncThreshold: 20, difficulty: 4.0, repeatable: true,
    pageMultiplier: 0.65, tiMultiplier: 1.10, objective: { validNetworks: 1 }, reward: 'matureExperience',
    patternId: 'stewardship',
    description: 'A repeatable late-campaign Field. Mature Fields rotate through several operational patterns instead of repeating one identical challenge.',
    rewardText: 'Awards renewable Field Experience for continued Legacy progression.'
  };

  // Mature Fields are deliberately derived from matureClears rather than stored as
  // another progression object. This keeps the save schema stable while making the
  // late campaign cycle through distinct forms of already-mastered work.
  const MATURE_FIELD_PATTERNS = [
    {
      patternId: 'stewardship', patternName: 'Stewardship Cycle', ncThreshold: 18, difficulty: 3.6,
      pageMultiplier: 0.72, tiMultiplier: 1.08, objective: { validNetworks: 1 },
      description: 'A recovery-focused Mature Field. Rebuild efficiently and establish one sound Network without relying on extreme modifiers.'
    },
    {
      patternId: 'translation', patternName: 'Translation Relay', ncThreshold: 20, difficulty: 3.9,
      pageMultiplier: 0.68, translationThresholdMultiplier: 8, tiMultiplier: 1.25, objective: { validNetworks: 1, translations: 3 },
      description: 'A Translation-focused Mature Field. Longer language-work cycles matter more than raw recovery speed.'
    },
    {
      patternId: 'distribution', patternName: 'Distribution Weave', ncThreshold: 20, difficulty: 4.1,
      pageMultiplier: 0.66, allocationCap: 0.45, digitalMin: 0.15, tiMultiplier: 1.08, objective: { validNetworks: 2 },
      description: 'A Network-focused Mature Field. Balanced routes and two valid Networks matter more than a single dominant channel.'
    },
    {
      patternId: 'integration', patternName: 'Integrated Practice', ncThreshold: 22, difficulty: 4.4,
      pageMultiplier: 0.58, preparationCap: 3, requireAllProjects: true, tiMultiplier: 1.10, objective: { validNetworks: 2, translations: 3 },
      description: 'A whole-system Mature Field. Projects, repeated Translations, and Network recovery must all work together.'
    }
  ];

  const TRADITIONS = [
    { id: 'translation', name: 'Translation Tradition', description: 'Long-cycle language work: +1 effective Preparation, stronger Translation specialization effects, and repeat readiness matures 8% sooner.' },
    { id: 'teaching', name: 'Teaching Tradition', description: 'Structured formation: milestone output ×1.12 and completed Project effects ×1.30.' },
    { id: 'distribution', name: 'Distribution Tradition', description: 'Route stewardship: normal allocation cap +5 points, Infrastructure Lv1 retained, and Distribution pair synergies are 20% stronger.' },
    { id: 'pioneer', name: 'Pioneer Tradition', description: 'Field-first continuity: Field NC requirements ×0.88 and fresh-NC entry preparation is waived after the first Legacy.' }
  ];

  const LEGACY_MILESTONES = [
    { amount: 1, id: 'foundationalMethods', name: 'Foundational Methods', description: 'Begin resets with the first three Page Methods.' },
    { amount: 2, id: 'projectsVisible', name: 'Open Projects', description: 'Projects are considered known from the beginning of each Legacy cycle.' },
    { amount: 3, id: 'buyMax', name: 'Retained Plans', description: 'Unfinished purchasing orders survive Legacy and Field resets.' },
    { amount: 5, id: 'specializationRetained', name: 'Specialization Continuity', description: 'Your Translation specialization survives Legacy resets.' },
    { amount: 8, id: 'automation', name: 'Established Workflow', description: 'Base producer automation survives Legacy resets.' },
    { amount: 12, id: 'translationUnlocked', name: 'Translation Foundation', description: 'The early Translation development chain begins partially restored.' },
    { amount: 20, id: 'firstTranslationCompressed', name: 'Compressed First Translation', description: 'Begin Legacy recovery with 10 TI already available.' },
    { amount: 30, id: 'networkPresets', name: 'Distribution Memory', description: 'Distribution presets survive Legacy resets.' },
    { amount: 50, id: 'networkRecovery', name: 'Network Recovery', description: 'Network thresholds compress with Legacy and resets begin with established NC.' },
    { amount: 75, id: 'fieldRetention', name: 'Field Continuity', description: 'Entering the next Field no longer requires fresh NC outside the Field itself.' },
    { amount: 100, id: 'finalSequence', name: 'To Every Nation', description: 'Unlock the final campaign sequence once all canonical Fields are cleared.' }
  ];

  const SCRIPTURE_COLLECTIONS = [
    { id: 'torah', name: 'Torah', role: 'Foundations & progression ledger', description: 'Marks the beginning of sustained Scripture work.' },
    { id: 'history', name: 'Historical Books', role: 'History & records', description: 'Highlights the accumulated history of resets and development.' },
    { id: 'wisdom', name: 'Wisdom', role: 'Statistics & presets', description: 'Represents planning, comparison, and deliberate stewardship.' },
    { id: 'prophets', name: 'Prophets', role: 'Field constraints', description: 'Introduces challenge-oriented progression and changing conditions.' },
    { id: 'gospels', name: 'Gospels', role: 'Campaign milestones', description: 'Frames the central campaign progression toward the nations.' },
    { id: 'acts', name: 'Acts', role: 'Mission systems & automation', description: 'Marks a mature, outward-moving network of work.' },
    { id: 'epistles', name: 'Epistles', role: 'Traditions & synergy', description: 'Unlocks with Legacy and the coordination of mature systems.' },
    { id: 'revelation', name: 'Revelation', role: 'Final sequence', description: 'Unlocks when the campaign is ready for its final completion sequence.' }
  ];

  const DISTRIBUTION_CHANNELS = [
    { id: 'local', name: 'Local', description: 'Strong early recovery that fades during the Network cycle.' },
    { id: 'regional', name: 'Regional', description: 'Stable Page-production support.' },
    { id: 'international', name: 'International', description: 'Improves Translation Insight gain.' },
    { id: 'digital', name: 'Digital', description: 'Reduces Project thresholds and Manuscript investment.' }
  ];

  function zeroMap(keys) { return Object.fromEntries(keys.map(k => [k, 0])); }
  function producerDef(id) { return PRODUCERS.find(x => x.id === id); }
  function upgradeDef(id) { return PAGE_UPGRADES.find(x => x.id === id); }
  function projectDef(id) { return PROJECTS.find(x => x.id === id); }
  function tiRepeatableDef(id) { return TI_REPEATABLES.find(x => x.id === id); }
  function tiOneTimeDef(id) { return TI_ONE_TIMES.find(x => x.id === id); }

  function emptyPreset(slot) {
    return { slot, name: `Preset ${slot}`, saved: false, specialization: null, auto: { enabled: true, minRun: 90, resetMultiple: 1.35, maxRun: 1800 } };
  }

  function emptyNetworkPreset(slot) {
    return { slot, name: `Distribution ${slot}`, saved: false, allocation: { local: 0.4, regional: 0.3, international: 0.2, digital: 0.1 } };
  }

  function createState() {
    return {
      version: VERSION,
      timePlayed: 0,
      runTime: 0,
      pages: bn(0),
      peakPages: bn(0),
      ti: bn(0),
      lifetimeTi: bn(0),
      translations: 0,
      producers: zeroMap(PRODUCERS.map(x => x.id)),
      pageUpgrades: zeroMap(PAGE_UPGRADES.map(x => x.id)),
      projects: { manuscript: false, reference: false, teaching: false },
      tiUpgrades: { workflow: 0, training: 0, preparation: 0 },
      tiOneTime: Object.fromEntries(TI_ONE_TIMES.map(x => [x.id, false])),
      specialization: null,
      queuedSpecialization: null,
      automation: {
        basic: false,
        full: false,
        projects: false,
        translation: false,
        controls: { baseEnabled: true, projectsEnabled: true, translationEnabled: true },
        autoSettings: { enabled: true, minRun: 90, resetMultiple: 1.35, maxRun: 1800 }
      },
      system: {
        offlineEnabled: true,
        offlineCapSeconds: 14 * 86400,
        keyboardShortcuts: true,
        confirmEarlyResets: true
      },
      presets: [emptyPreset(1), emptyPreset(2), emptyPreset(3)],
      records: {
        firstPurchaseAt: null,
        firstUpgradeAt: null,
        firstProjectAt: null,
        firstThresholdAt: null,
        firstTranslationAt: null,
        specializationUnlockedAt: null,
        translationAutomationAt: null,
        phase2MasteredAt: null,
        firstNetworkAt: null,
        bestNetworkGain: bn(0),
        fastestNetwork: null,
        recentNetworks: [],
        fieldUnlockedAt: null,
        firstFieldAt: null,
        firstFieldClearAt: null,
        legacyReadyAt: null,
        firstLegacyAt: null,
        finalPhaseAt: null,
        campaignCompleteAt: null,
        bestLegacyGain: bn(0),
        fastestLegacy: null,
        recentLegacies: [],
        recentFields: [],
        highestPps: bn(2),
        lastTranslationGain: bn(0),
        bestTranslationGain: bn(0),
        fastestTranslation: null,
        recentTranslations: [],
        offlineSeconds: 0,
        offlineSessions: 0,
        largestOfflineGap: 0,
        saveRecoveries: 0
      },
      nc: bn(0),
      lifetimeNc: bn(0),
      tiThisNetwork: bn(0),
      ncThisField: bn(0),
      networks: 0,
      networkRunTime: 0,
      allocation: { local: 0.4, regional: 0.3, international: 0.2, digital: 0.1 },
      netUpgrades: { infrastructure: 0 },
      netOneTime: Object.fromEntries(NETWORK_UPGRADES.filter(x => !x.repeatable).map(x => [x.id, false])),
      networkPresets: [emptyNetworkPreset(1), emptyNetworkPreset(2), emptyNetworkPreset(3)],
      fe: bn(0),
      lifetimeFe: bn(0),
      feThisLegacy: bn(0),
      legacy: bn(0),
      lifetimeLegacy: bn(0),
      legacies: 0,
      legacyRunTime: 0,
      tradition: null,
      queuedTradition: null,
      field: {
        active: false, activeId: null, cleared: [], index: 0, matureClears: 0, progressNc: bn(0), enteredAt: null,
        stats: { translations: 0, networks: 0, validNetworks: 0, projects: [], allocations: [] }
      },
      fieldRewards: {
        allocationCap: 0.70, preparationBoost: false, firstProjectRetained: false, persistentAutomation: false,
        internationalBonus: 1, regionalBonus: 1, networkStartNc: 0, fieldThresholdMult: 1
      },
      campaign: { tier1: 0, tier2: 0, tier3: 0, complete: false },
      purchaseQueue: { paused: false, orders: [] },
      reading: { bookmarks: [], fontSize: 18 },
      settlement: { buildings: {}, methods: {}, commissions: {}, decorations: { banner: "indigo", planting: "olive", courtyard: "planters" }, onboarding: {} },
      economyCycle: -1,
      library: {},
      phase2Complete: false,
      phase3Complete: false,
      phase4Complete: false,
      phase5Complete: false,
      createdAt: Date.now(),
      lastSavedAt: Date.now()
    };
  }

  function safeBn(value, fallback = 0) {
    try {
      const n = bn(value === undefined ? fallback : value);
      return Number.isFinite(n.log10) || n.isZero ? n : bn(fallback);
    } catch { return bn(fallback); }
  }

  function finiteNonNegative(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;
  }


  function safePlainText(value, fallback = '', maxLength = 80) {
    const base = typeof value === 'string' ? value : fallback;
    const cleaned = base
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
    return cleaned || fallback;
  }

  function safeNullableTime(value) {
    if (value === null || value === undefined) return null;
    return finiteNonNegative(value, null, 1e12);
  }

  function safeSpecialization(value) {
    return SPECIALIZATIONS.some(x => x.id === value) ? value : null;
  }

  function safeTradition(value) {
    return TRADITIONS.some(x => x.id === value) ? value : null;
  }

  function safeAllocationPayload(value) {
    const normalized = normalizeAllocation(value || {});
    return {
      local: finiteNonNegative(normalized.local, 0.4, 1),
      regional: finiteNonNegative(normalized.regional, 0.3, 1),
      international: finiteNonNegative(normalized.international, 0.2, 1),
      digital: finiteNonNegative(normalized.digital, 0.1, 1)
    };
  }

  function sanitizedAutoSettings(value) {
    const base = { enabled: true, minRun: 90, resetMultiple: 1.35, maxRun: 1800 };
    const raw = value && typeof value === 'object' ? value : {};
    const minRun = Math.max(1, Math.min(7200, Number(raw.minRun) || base.minRun));
    return {
      enabled: raw.enabled === undefined ? base.enabled : !!raw.enabled,
      minRun,
      resetMultiple: Math.max(1, Math.min(10, Number(raw.resetMultiple) || base.resetMultiple)),
      maxRun: Math.max(minRun, Math.min(21600, Number(raw.maxRun) || base.maxRun))
    };
  }

  function finiteInt(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
    return Math.floor(finiteNonNegative(value, fallback, max));
  }

  function isBigNumPayload(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
    if (typeof value === 'string') return /^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+(?:\.\d+)?)?$/i.test(value.trim());
    if (typeof value === 'object') {
      if (value.zero === true) return true;
      return value.log10 === null || (typeof value.log10 === 'number' && Number.isFinite(value.log10));
    }
    return false;
  }

  function validateStatePayload(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['Save state must be an object.'] };
    if (raw.version !== undefined && (!Number.isFinite(Number(raw.version)) || Number(raw.version) > VERSION)) errors.push('Save was created by a newer, unsupported game-state version.');
    for (const key of ['pages','peakPages','ti','lifetimeTi','nc','lifetimeNc','tiThisNetwork','ncThisField','fe','lifetimeFe','feThisLegacy','legacy','lifetimeLegacy']) {
      if (key in raw && !isBigNumPayload(raw[key])) errors.push(`Invalid numeric payload: ${key}`);
    }
    for (const key of ['timePlayed','runTime','networkRunTime','legacyRunTime','translations','networks','legacies']) {
      if (key in raw && (!Number.isFinite(Number(raw[key])) || Number(raw[key]) < 0)) errors.push(`Invalid non-negative value: ${key}`);
    }
    if (raw.allocation && typeof raw.allocation === 'object') {
      for (const key of ['local','regional','international','digital']) {
        if (key in raw.allocation && (!Number.isFinite(Number(raw.allocation[key])) || Number(raw.allocation[key]) < 0 || Number(raw.allocation[key]) > 1)) errors.push(`Invalid allocation: ${key}`);
      }
    }
    if (raw.field?.index !== undefined && (!Number.isFinite(Number(raw.field.index)) || Number(raw.field.index) < 0 || Number(raw.field.index) > FIELDS.length)) errors.push('Invalid Field index.');
    if (raw.field?.cleared !== undefined) {
      if (!Array.isArray(raw.field.cleared)) errors.push('Invalid Field-cleared payload.');
      else if (raw.field.cleared.some(id => typeof id !== 'string' || !FIELDS.some(f => f.id === id))) errors.push('Unknown cleared Field id.');
    }
    if (raw.field?.activeId !== undefined && raw.field.activeId !== null && raw.field.activeId !== MATURE_FIELD.id && !FIELDS.some(f => f.id === raw.field.activeId)) errors.push('Unknown active Field id.');
    return { ok: errors.length === 0, errors };
  }

  function sanitizeState(state) {
    state.timePlayed = finiteNonNegative(state.timePlayed, 0, 1e12);
    state.runTime = finiteNonNegative(state.runTime, 0, 1e12);
    state.networkRunTime = finiteNonNegative(state.networkRunTime, state.timePlayed, 1e12);
    state.legacyRunTime = finiteNonNegative(state.legacyRunTime, 0, 1e12);
    state.translations = finiteInt(state.translations, 0, 1e9);
    state.networks = finiteInt(state.networks, 0, 1e9);
    state.legacies = finiteInt(state.legacies, 0, 1e9);
    for (const def of PRODUCERS) state.producers[def.id] = finiteInt(state.producers[def.id], 0, 1e7);
    for (const def of PAGE_UPGRADES) state.pageUpgrades[def.id] = state.pageUpgrades[def.id] ? 1 : 0;
    for (const def of PROJECTS) state.projects[def.id] = !!state.projects[def.id];
    state.specialization = safeSpecialization(state.specialization);
    state.queuedSpecialization = safeSpecialization(state.queuedSpecialization);
    state.tradition = safeTradition(state.tradition);
    state.queuedTradition = safeTradition(state.queuedTradition);
    for (const def of TI_ONE_TIMES) state.tiOneTime[def.id] = !!state.tiOneTime[def.id];
    for (const def of NETWORK_UPGRADES.filter(x => !x.repeatable)) state.netOneTime[def.id] = !!state.netOneTime[def.id];
    state.tiUpgrades.workflow = finiteInt(state.tiUpgrades.workflow, 0, 10000);
    state.tiUpgrades.training = finiteInt(state.tiUpgrades.training, 0, 10000);
    state.tiUpgrades.preparation = finiteInt(state.tiUpgrades.preparation, 0, 6);
    state.netUpgrades.infrastructure = finiteInt(state.netUpgrades.infrastructure, 0, 12);
    const validFieldIds = new Set(FIELDS.map(f => f.id));
    state.field.cleared = Array.isArray(state.field.cleared) ? [...new Set(state.field.cleared.filter(id => validFieldIds.has(id)))] : [];
    state.field.index = state.field.cleared.length;
    state.field.activeId = state.field.active && (validFieldIds.has(state.field.activeId) || state.field.activeId === MATURE_FIELD.id) ? state.field.activeId : null;
    state.field.matureClears = finiteInt(state.field.matureClears, 0, 1e9);
    state.field.stats.translations = finiteInt(state.field.stats.translations, 0, 1e9);
    state.field.stats.networks = finiteInt(state.field.stats.networks, 0, 1e9);
    state.field.stats.validNetworks = finiteInt(state.field.stats.validNetworks, 0, 1e9);
    const routeCounts = fieldClearCounts(state);
    state.campaign.tier1 = routeCounts.tier1;
    state.campaign.tier2 = routeCounts.tier2;
    state.campaign.tier3 = routeCounts.tier3;
    state.records.offlineSeconds = finiteNonNegative(state.records.offlineSeconds, 0, 1e12);
    state.records.offlineSessions = finiteInt(state.records.offlineSessions, 0, 1e9);
    state.records.largestOfflineGap = finiteNonNegative(state.records.largestOfflineGap, 0, 1e12);
    state.records.saveRecoveries = finiteInt(state.records.saveRecoveries, 0, 1e9);
    setAutomationControls(state, state.automation.controls || {});
    setAutoSettings(state, state.automation.autoSettings || {});
    setSystemSettings(state, state.system || {});
    const normalized = normalizeAllocation(state.allocation);
    state.allocation = isAllocationValid(state, normalized) ? normalized : recommendedFieldAllocation(currentField(state));
    state.lastSavedAt = finiteNonNegative(state.lastSavedAt, Date.now(), Date.now() + 86400000);
    return state;
  }

  function reviveState(raw) {
    const fresh = createState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fresh;

    const recentNetworks = Array.isArray(raw.records?.recentNetworks)
      ? raw.records.recentNetworks.slice(0, 12).map(r => ({
          at: finiteNonNegative(r?.at, 0, 1e12),
          duration: finiteNonNegative(r?.duration, 0, 1e12),
          gain: safeBn(r?.gain, 0),
          tiEarned: safeBn(r?.tiEarned, 0),
          allocation: safeAllocationPayload(r?.allocation)
        }))
      : [];

    const fieldById = new Map([...FIELDS, MATURE_FIELD].map(f => [f.id, f]));
    const recentFields = Array.isArray(raw.records?.recentFields)
      ? raw.records.recentFields.slice(0, 12).map(r => {
          const def = fieldById.get(r?.id) || null;
          const id = def?.id || 'unknown';
          return {
            id,
            name: def?.name || 'Unknown Field',
            tier: def?.tier || 0,
            enteredAt: finiteNonNegative(r?.enteredAt, 0, 1e12),
            at: finiteNonNegative(r?.at, 0, 1e12),
            duration: finiteNonNegative(r?.duration, 0, 1e12),
            gain: safeBn(r?.gain, 0),
            translations: finiteInt(r?.translations, 0, 1e9),
            networks: finiteInt(r?.networks, 0, 1e9),
            validNetworks: finiteInt(r?.validNetworks, 0, 1e9),
            projects: Array.isArray(r?.projects) ? [...new Set(r.projects.filter(id => PROJECTS.some(p => p.id === id)))].slice(0, PROJECTS.length) : [],
            progressNc: safeBn(r?.progressNc, 0),
            allocations: Array.isArray(r?.allocations) ? r.allocations.slice(0, 100).map(safeAllocationPayload) : []
          };
        })
      : [];

    const recentLegacies = Array.isArray(raw.records?.recentLegacies)
      ? raw.records.recentLegacies.slice(0, 12).map(r => ({
          at: finiteNonNegative(r?.at, 0, 1e12),
          duration: finiteNonNegative(r?.duration, 0, 1e12),
          gain: safeBn(r?.gain, 0),
          fe: safeBn(r?.fe, 0),
          fieldIndex: finiteInt(r?.fieldIndex, 0, FIELDS.length),
          matureClears: finiteInt(r?.matureClears, 0, 1e9)
        }))
      : [];

    const recentTranslations = Array.isArray(raw.records?.recentTranslations)
      ? raw.records.recentTranslations.slice(0, 12).map(r => ({
          at: finiteNonNegative(r?.at, 0, 1e12),
          duration: finiteNonNegative(r?.duration, 0, 1e12),
          gain: safeBn(r?.gain, 0),
          automated: !!r?.automated,
          specialization: safeSpecialization(r?.specialization)
        }))
      : [];

    const records = {
      ...fresh.records,
      firstPurchaseAt: safeNullableTime(raw.records?.firstPurchaseAt),
      firstUpgradeAt: safeNullableTime(raw.records?.firstUpgradeAt),
      firstProjectAt: safeNullableTime(raw.records?.firstProjectAt),
      firstThresholdAt: safeNullableTime(raw.records?.firstThresholdAt),
      firstTranslationAt: safeNullableTime(raw.records?.firstTranslationAt),
      specializationUnlockedAt: safeNullableTime(raw.records?.specializationUnlockedAt),
      translationAutomationAt: safeNullableTime(raw.records?.translationAutomationAt),
      phase2MasteredAt: safeNullableTime(raw.records?.phase2MasteredAt),
      firstNetworkAt: safeNullableTime(raw.records?.firstNetworkAt),
      fieldUnlockedAt: safeNullableTime(raw.records?.fieldUnlockedAt),
      firstFieldAt: safeNullableTime(raw.records?.firstFieldAt),
      firstFieldClearAt: safeNullableTime(raw.records?.firstFieldClearAt),
      legacyReadyAt: safeNullableTime(raw.records?.legacyReadyAt),
      firstLegacyAt: safeNullableTime(raw.records?.firstLegacyAt),
      finalPhaseAt: safeNullableTime(raw.records?.finalPhaseAt),
      campaignCompleteAt: safeNullableTime(raw.records?.campaignCompleteAt),
      highestPps: safeBn(raw.records?.highestPps, 2),
      lastTranslationGain: safeBn(raw.records?.lastTranslationGain, 0),
      bestTranslationGain: safeBn(raw.records?.bestTranslationGain, 0),
      bestNetworkGain: safeBn(raw.records?.bestNetworkGain, 0),
      bestLegacyGain: safeBn(raw.records?.bestLegacyGain, 0),
      fastestTranslation: safeNullableTime(raw.records?.fastestTranslation),
      fastestNetwork: safeNullableTime(raw.records?.fastestNetwork),
      fastestLegacy: safeNullableTime(raw.records?.fastestLegacy),
      recentNetworks,
      recentFields,
      recentLegacies,
      recentTranslations,
      offlineSeconds: finiteNonNegative(raw.records?.offlineSeconds, 0, 1e12),
      offlineSessions: finiteInt(raw.records?.offlineSessions, 0, 1e9),
      largestOfflineGap: finiteNonNegative(raw.records?.largestOfflineGap, 0, 1e12),
      saveRecoveries: finiteInt(raw.records?.saveRecoveries, 0, 1e9)
    };

    const migratedLifetimeTi = raw.lifetimeTi !== undefined ? safeBn(raw.lifetimeTi, 0) : safeBn(raw.ti, 0);

    const safePresets = fresh.presets.map((base, i) => {
      const input = Array.isArray(raw.presets) && raw.presets[i] && typeof raw.presets[i] === 'object' ? raw.presets[i] : {};
      return {
        slot: i + 1,
        name: safePlainText(input.name, `Preset ${i + 1}`, 48),
        saved: !!input.saved,
        specialization: safeSpecialization(input.specialization),
        auto: sanitizedAutoSettings(input.auto)
      };
    });

    const safeNetworkPresets = fresh.networkPresets.map((base, i) => {
      const input = Array.isArray(raw.networkPresets) && raw.networkPresets[i] && typeof raw.networkPresets[i] === 'object' ? raw.networkPresets[i] : {};
      return {
        slot: i + 1,
        name: safePlainText(input.name, `Distribution ${i + 1}`, 48),
        saved: !!input.saved,
        allocation: safeAllocationPayload(input.allocation)
      };
    });

    const validCanonicalFieldIds = new Set(FIELDS.map(f => f.id));
    const migratedFieldIndex = finiteInt(raw.field?.index, 0, FIELDS.length);
    const rawClearedFields = Array.isArray(raw.field?.cleared) ? [...new Set(raw.field.cleared.filter(id => validCanonicalFieldIds.has(id)))] : null;
    const migratedClearedFields = rawClearedFields && (rawClearedFields.length > 0 || migratedFieldIndex === 0)
      ? rawClearedFields
      : FIELDS.slice(0, migratedFieldIndex).map(f => f.id);
    const migratedActiveId = raw.field?.active
      ? (validCanonicalFieldIds.has(raw.field?.activeId) || raw.field?.activeId === MATURE_FIELD.id
          ? raw.field.activeId
          : (migratedFieldIndex >= FIELDS.length ? MATURE_FIELD.id : FIELDS[migratedFieldIndex]?.id || null))
      : null;

    const revived = {
      ...fresh,
      purchaseQueue: sanitizePurchaseQueue(raw.purchaseQueue),
      reading: { bookmarks: Array.isArray(raw.reading?.bookmarks) ? [...new Set(raw.reading.bookmarks.filter(x => typeof x === 'string' && /^[a-z0-9-]{1,80}$/.test(x)))].slice(0, 200) : [], fontSize: [16,18,20,22].includes(raw.reading?.fontSize) ? raw.reading.fontSize : 18 },
      economyCycle: Math.min(Math.floor(finiteNonNegative(raw.timePlayed)/10), Number.isFinite(raw.economyCycle) ? Math.floor(raw.economyCycle) : -1),
      version: VERSION,
      timePlayed: finiteNonNegative(raw.timePlayed, 0, 1e12),
      runTime: finiteNonNegative(raw.runTime, 0, 1e12),
      pages: safeBn(raw.pages, 0),
      peakPages: safeBn(raw.peakPages, 0),
      ti: safeBn(raw.ti, 0),
      lifetimeTi: migratedLifetimeTi,
      translations: finiteInt(raw.translations, 0, 1e9),
      producers: Object.fromEntries(PRODUCERS.map(x => [x.id, raw.producers?.[x.id] ?? fresh.producers[x.id]])),
      pageUpgrades: Object.fromEntries(PAGE_UPGRADES.map(x => [x.id, raw.pageUpgrades?.[x.id] ?? fresh.pageUpgrades[x.id]])),
      projects: Object.fromEntries(PROJECTS.map(x => [x.id, !!raw.projects?.[x.id]])),
      tiUpgrades: { workflow: raw.tiUpgrades?.workflow ?? 0, training: raw.tiUpgrades?.training ?? 0, preparation: raw.tiUpgrades?.preparation ?? 0 },
      tiOneTime: Object.fromEntries(TI_ONE_TIMES.map(x => [x.id, !!raw.tiOneTime?.[x.id]])),
      specialization: safeSpecialization(raw.specialization),
      queuedSpecialization: safeSpecialization(raw.queuedSpecialization),
      automation: {
        ...fresh.automation,
        basic: !!raw.automation?.basic,
        full: !!raw.automation?.full,
        projects: !!raw.automation?.projects,
        translation: !!raw.automation?.translation,
        controls: { baseEnabled: raw.automation?.controls?.baseEnabled !== false, projectsEnabled: raw.automation?.controls?.projectsEnabled !== false, translationEnabled: raw.automation?.controls?.translationEnabled !== false },
        autoSettings: sanitizedAutoSettings(raw.automation?.autoSettings)
      },
      system: { offlineEnabled: raw.system?.offlineEnabled !== false, offlineCapSeconds: raw.system?.offlineCapSeconds ?? fresh.system.offlineCapSeconds, keyboardShortcuts: raw.system?.keyboardShortcuts !== false, confirmEarlyResets: raw.system?.confirmEarlyResets !== false },
      presets: safePresets,
      nc: safeBn(raw.nc, 0),
      lifetimeNc: safeBn(raw.lifetimeNc, 0),
      tiThisNetwork: safeBn(raw.tiThisNetwork, 0),
      ncThisField: safeBn(raw.ncThisField, 0),
      networks: finiteInt(raw.networks, 0, 1e9),
      networkRunTime: finiteNonNegative(raw.networkRunTime, raw.timePlayed || 0, 1e12),
      allocation: safeAllocationPayload(raw.allocation),
      netUpgrades: { infrastructure: finiteInt(raw.netUpgrades?.infrastructure, 0, 12) },
      netOneTime: Object.fromEntries(NETWORK_UPGRADES.filter(x => !x.repeatable).map(x => [x.id, !!raw.netOneTime?.[x.id]])),
      networkPresets: safeNetworkPresets,
      fe: safeBn(raw.fe, 0),
      lifetimeFe: safeBn(raw.lifetimeFe, 0),
      feThisLegacy: safeBn(raw.feThisLegacy, 0),
      legacy: safeBn(raw.legacy, 0),
      lifetimeLegacy: safeBn(raw.lifetimeLegacy, 0),
      legacies: finiteInt(raw.legacies, 0, 1e9),
      legacyRunTime: finiteNonNegative(raw.legacyRunTime, 0, 1e12),
      tradition: safeTradition(raw.tradition),
      queuedTradition: safeTradition(raw.queuedTradition),
      field: {
        ...fresh.field,
        active: !!raw.field?.active,
        activeId: migratedActiveId,
        cleared: migratedClearedFields,
        index: migratedClearedFields.length,
        matureClears: finiteInt(raw.field?.matureClears, 0, 1e9),
        progressNc: safeBn(raw.field?.progressNc, 0),
        enteredAt: safeNullableTime(raw.field?.enteredAt),
        stats: {
          translations: finiteInt(raw.field?.stats?.translations, 0, 1e9),
          networks: finiteInt(raw.field?.stats?.networks, 0, 1e9),
          validNetworks: finiteInt(raw.field?.stats?.validNetworks, 0, 1e9),
          projects: Array.isArray(raw.field?.stats?.projects) ? [...new Set(raw.field.stats.projects.filter(id => PROJECTS.some(p => p.id === id)))].slice(0, PROJECTS.length) : [],
          allocations: Array.isArray(raw.field?.stats?.allocations) ? raw.field.stats.allocations.slice(0, 100).map(safeAllocationPayload) : []
        }
      },
      fieldRewards: {
        allocationCap: Math.max(0.4, Math.min(0.95, Number(raw.fieldRewards?.allocationCap) || fresh.fieldRewards.allocationCap)),
        preparationBoost: !!raw.fieldRewards?.preparationBoost,
        firstProjectRetained: !!raw.fieldRewards?.firstProjectRetained,
        persistentAutomation: !!raw.fieldRewards?.persistentAutomation,
        internationalBonus: Math.max(1, Math.min(5, Number(raw.fieldRewards?.internationalBonus) || 1)),
        regionalBonus: Math.max(1, Math.min(5, Number(raw.fieldRewards?.regionalBonus) || 1)),
        networkStartNc: finiteInt(raw.fieldRewards?.networkStartNc, 0, 1000),
        fieldThresholdMult: Math.max(0.1, Math.min(1, Number(raw.fieldRewards?.fieldThresholdMult) || 1))
      },
      campaign: {
        tier1: finiteInt(raw.campaign?.tier1, 0, 5),
        tier2: finiteInt(raw.campaign?.tier2, 0, 3),
        tier3: finiteInt(raw.campaign?.tier3, 0, 1),
        complete: !!raw.campaign?.complete
      },
      library: Object.fromEntries(SCRIPTURE_COLLECTIONS.map(x => [x.id, !!raw.library?.[x.id]])),
      records,
      phase1Complete: undefined,
      phase2Complete: !!raw.phase2Complete,
      phase3Complete: !!raw.phase3Complete,
      phase4Complete: !!raw.phase4Complete,
      phase5Complete: !!raw.phase5Complete || !!raw.campaign?.complete,
      createdAt: finiteNonNegative(raw.createdAt, fresh.createdAt, Date.now() + 86400000),
      lastSavedAt: finiteNonNegative(raw.lastSavedAt, fresh.lastSavedAt, Date.now() + 86400000)
    };
    // Schema migration is applied to the old snapshot only; lifetime counters stay untouched.
    if (Number(raw.version || 0) < 7 && raw.tiOneTime?.buyMax) revived.ti = revived.ti.add(30);
    revived.settlement = sanitizeSettlement(raw.settlement, revived);
    return sanitizeState(revived);
  }

  function sanitizeSettlement(raw, state) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return {
      buildings: Object.fromEntries(PRODUCERS.map(p => [p.id, Math.max(finiteInt(r.buildings?.[p.id], 0, 100000), finiteInt(state.producers[p.id], 0, 100000))])),
      methods: Object.fromEntries(PAGE_UPGRADES.map(p => [p.id, !!r.methods?.[p.id] || !!state.pageUpgrades[p.id]])),
      commissions: Object.fromEntries(PROJECTS.map(p => [p.id, !!r.commissions?.[p.id] || !!state.projects[p.id]])),
      decorations: {
        banner: ['indigo','clay','olive'].includes(r.decorations?.banner) ? r.decorations.banner : 'indigo',
        planting: ['olive','cypress','flowers'].includes(r.decorations?.planting) ? r.decorations.planting : 'olive',
        courtyard: ['planters','bench','fountain'].includes(r.decorations?.courtyard) ? r.decorations.courtyard : 'planters'
      },
      onboarding: Object.fromEntries(['approach','commission','welcome'].map(k => [k, !!r.onboarding?.[k]]))
    };
  }
  // Immutable memory updates also keep economic previews pure when they shallow-copy state.
  function rememberSettlement(state, kind, id, value) {
    const memory = state.settlement || sanitizeSettlement(null, state);
    state.settlement = {...memory, [kind]: {...memory[kind], [id]: kind === 'buildings' ? Math.max(memory[kind][id] || 0, value) : value}};
  }
  function setSettlementDecoration(state, key, value) {
    const allowed = {banner:['indigo','clay','olive'],planting:['olive','cypress','flowers'],courtyard:['planters','bench','fountain']};
    if (!Object.hasOwn(allowed,key) || !allowed[key].includes(value)) return false;
    const memory = state.settlement || sanitizeSettlement(null, state);
    state.settlement = {...memory,decorations:{...memory.decorations,[key]:value}}; return true;
  }
  function serializeState(state) {
    return JSON.stringify({ ...state, lastSavedAt: Date.now() });
  }

  function rawProducerCost(def, owned) {
    return piecewiseLogCost({
      baseLog10: def.baseLog10,
      slope: Math.log10(def.ratio),
      quadratic: [{ start: def.qStart, coefficient: def.q }],
      cubic: [{ start: def.cStart, coefficient: def.c }]
    }, owned);
  }

  function producerCost(def, owned, state = null) {
    let cost = rawProducerCost(def, owned);
    if (state?.specialization === 'publisher') {
      const baseDiscount = state.tradition === 'translation' ? 0.73 : 0.75;
      const earlyDiscount = state.tradition === 'translation' ? 0.89 : 0.90;
      cost = cost.mul(baseDiscount);
      if (owned < 100) cost = cost.mul(earlyDiscount);
    }
    return cost;
  }

  function milestoneMultiplier(owned, state = null) {
    let m = 1;
    if (owned >= 10) m *= 2;
    if (owned >= 25) m *= 2;
    if (owned >= 50) m *= 3;
    if (owned >= 250) m *= 4;
    if (state?.specialization === 'teacher' && owned >= 10) m *= state.tradition === 'translation' ? 1.165 : 1.15;
    if (state?.tradition === 'teaching' && owned >= 10) m *= 1.12;
    return m;
  }

  function workflowMultiplier(state) { return 1.45 ** state.tiUpgrades.workflow; }
  function trainingFactor(state) { return 1 + 0.08 * state.tiUpgrades.training; }

  function scholarMultiplier(state) {
    if (state.specialization !== 'scholar' || state.runTime <= 600) return 1;
    const minsAfter = (state.runTime - 600) / 60;
    const bonus = state.tradition === 'translation' ? 0.55 : 0.5;
    return 1 + bonus * (1 - Math.exp(-minsAfter / 20));
  }

  function translationReadinessTarget(state) {
    const base = state.lifetimeNc.gt(0) ? 20 * 60 : 10 * 60;
    // Publisher is deliberately the fast-cycle specialization: it reaches full
    // readiness 15% sooner, but does not increase the raw Translation formula.
    let target = state.specialization === 'publisher' ? base * 0.85 : base;
    if (state.tradition === 'translation') target *= 0.92;
    return target;
  }

  function specializationTiMultiplier(state) {
    if (state.specialization === 'scholar') {
      // Scholar gains a small, bounded long-run dividend after 20 minutes.
      if (state.runTime <= 20 * 60) return 1;
      const elapsed = state.runTime - 20 * 60;
      return 1 + 0.10 * (1 - Math.exp(-elapsed / (20 * 60)));
    }
    if (state.specialization === 'teacher') {
      // Teacher converts completed Project structure into a modest TI dividend.
      const completed = ['manuscript','reference','teaching'].filter(id => !!state.projects[id]).length;
      return 1 + 0.03 * completed;
    }
    return 1;
  }

  function synergyExponent(state, lowerId) {
    const owned = state.producers[lowerId] || 0;
    let exp = 0.45;
    if (owned >= 100) exp += 0.05;
    if (state.projects.reference) exp += 0.05;
    return exp * trainingFactor(state);
  }

  function globalUpgradeMultiplier(state) {
    let m = 1;
    for (const def of PAGE_UPGRADES) {
      if (state.pageUpgrades[def.id] && def.globalMult) m *= def.globalMult;
    }
    return m;
  }

  function clearedFieldSet(state) {
    const cleared = Array.isArray(state.field?.cleared) ? state.field.cleared : [];
    if (cleared.length || !(state.field?.index > 0)) return new Set(cleared);
    return new Set(FIELDS.slice(0, state.field.index).map(f => f.id));
  }

  function fieldClearCounts(state) {
    const cleared = clearedFieldSet(state);
    return {
      tier1: FIELDS.filter(f => f.tier === 1 && cleared.has(f.id)).length,
      tier2: FIELDS.filter(f => f.tier === 2 && cleared.has(f.id)).length,
      tier3: FIELDS.filter(f => f.tier === 3 && cleared.has(f.id)).length,
      total: FIELDS.filter(f => cleared.has(f.id)).length
    };
  }

  function fieldMasteryStatus(state) {
    const counts = fieldClearCounts(state);
    return {
      tier1: { cleared: counts.tier1, total: 5, mastered: counts.tier1 >= 5, reward: 'Route Archive' },
      tier2: { cleared: counts.tier2, total: 3, mastered: counts.tier2 >= 3, reward: 'Advanced Debriefs' },
      tier3: { cleared: counts.tier3, total: 1, mastered: counts.tier3 >= 1, reward: 'Mature Fields and permanent automation retention' },
      canonical: { cleared: counts.total, total: FIELDS.length, mastered: counts.total >= FIELDS.length }
    };
  }

  function fieldEligibility(state, field) {
    if (!field || state.campaign?.complete || state.field?.active) return false;
    if (field.repeatable) return fieldClearCounts(state).total >= FIELDS.length;
    const cleared = clearedFieldSet(state);
    if (cleared.has(field.id)) return false;
    const counts = fieldClearCounts(state);
    if (field.tier === 1) return true;
    if (field.tier === 2) return counts.tier1 >= 3 && (!field.requiresField || cleared.has(field.requiresField));
    if (field.tier === 3) return counts.tier2 >= 2;
    return false;
  }

  function fieldLockedReason(state, field) {
    if (!field) return 'Unavailable';
    const cleared = clearedFieldSet(state);
    if (!field.repeatable && cleared.has(field.id)) return 'Cleared';
    const counts = fieldClearCounts(state);
    if (field.tier === 2 && counts.tier1 < 3) return `Clear ${3 - counts.tier1} more Tier I Field${3 - counts.tier1 === 1 ? '' : 's'}`;
    if (field.tier === 2 && field.requiresField && !cleared.has(field.requiresField)) {
      const parent = FIELDS.find(f => f.id === field.requiresField);
      return `Clear ${parent?.name || 'its Tier I route'} first`;
    }
    if (field.tier === 3 && counts.tier2 < 2) return `Clear ${2 - counts.tier2} more Tier II Field${2 - counts.tier2 === 1 ? '' : 's'}`;
    if (field.repeatable && counts.total < FIELDS.length) return `Master ${FIELDS.length - counts.total} more canonical Field${FIELDS.length - counts.total === 1 ? '' : 's'}`;
    return fieldEligibility(state, field) ? 'Available' : 'Unavailable';
  }

  function matureFieldForState(state) {
    const count = Math.max(0, Number(state?.field?.matureClears || 0));
    const pattern = MATURE_FIELD_PATTERNS[count % MATURE_FIELD_PATTERNS.length];
    const cycle = Math.floor(count / MATURE_FIELD_PATTERNS.length) + 1;
    const tradition = state?.tradition;
    const field = { ...MATURE_FIELD, ...pattern, objective: { ...(pattern.objective || {}) }, matureCycle: cycle };
    field.name = `Mature Field · ${pattern.patternName}`;
    // Traditions alter the shape they already specialize in, never every pattern.
    if (tradition === 'translation' && pattern.patternId === 'translation') field.tiMultiplier *= 1.08;
    if (tradition === 'teaching' && pattern.patternId === 'integration') field.projectMultiplier = 1.25;
    if (tradition === 'distribution' && pattern.patternId === 'distribution') field.digitalMin = Math.max(0, field.digitalMin - 0.05);
    if (tradition === 'pioneer') field.ncThreshold *= 0.94;
    return field;
  }

  function matureCycleStatus(state) {
    const count = Math.max(0, Number(state?.field?.matureClears || 0));
    return {
      totalClears: count,
      patternIndex: count % MATURE_FIELD_PATTERNS.length,
      cycle: Math.floor(count / MATURE_FIELD_PATTERNS.length) + 1,
      completedInCycle: count % MATURE_FIELD_PATTERNS.length,
      cycleComplete: count > 0 && count % MATURE_FIELD_PATTERNS.length === 0,
      next: matureFieldForState(state)
    };
  }

  function availableFields(state) {
    if (state.field?.active || state.campaign?.complete) return [];
    const available = FIELDS.filter(field => fieldEligibility(state, field));
    if (available.length) return available;
    const mature = matureFieldForState(state);
    return fieldEligibility(state, mature) ? [mature] : [];
  }

  function currentField(state) {
    if (!state.field?.active) return null;
    const id = state.field.activeId;
    if (id) return FIELDS.find(f => f.id === id) || (id === MATURE_FIELD.id ? matureFieldForState(state) : null);
    return FIELDS[state.field.index] || (state.field.index >= FIELDS.length ? matureFieldForState(state) : null);
  }

  function nextField(state) {
    return availableFields(state)[0] || null;
  }

  function legacyMilestones(state, lifetimeOverride = null) {
    const source = lifetimeOverride === null || lifetimeOverride === undefined ? state.lifetimeLegacy : bn(lifetimeOverride);
    const value = source.toNumber();
    return Object.fromEntries(LEGACY_MILESTONES.map(m => [m.id, value + 1e-9 >= m.amount]));
  }

  function legacyPowerMultiplier(state) {
    return Math.min(3, 1 + Math.log10(1 + state.lifetimeLegacy.toNumber()) * 0.25);
  }

  function traditionDef(id) { return TRADITIONS.find(t => t.id === id); }

  function setTradition(state, id) {
    if (state.legacies < 1 || !traditionDef(id)) return false;
    if (!state.tradition) { state.tradition = id; return true; }
    if (state.tradition === id) return true;
    state.queuedTradition = id;
    return true;
  }

  function effectiveNetworkThreshold(state) {
    const l = state.lifetimeLegacy.toNumber();
    const compression = l > 0 ? 1 + Math.min(7, Math.sqrt(Math.max(0, l))) : 1;
    return NETWORK_BASE_THRESHOLD.div(compression);
  }

  function fieldThreshold(state, field = currentField(state)) {
    if (!field) return bn(0);
    const l = state.lifetimeLegacy.toNumber();
    const compression = l > 0 ? 1 + Math.min(4, Math.sqrt(Math.max(0, l))) : 1;
    const tradition = state.tradition === 'pioneer' ? 0.88 : 1;
    return bn(field.ncThreshold).mul((state.fieldRewards?.fieldThresholdMult || 1) * tradition).div(compression);
  }

  function effectivePreparationLevel(state, legacyOverride = null) {
    const legacy = legacyMilestones(state, legacyOverride);
    let level = Number(state.tiUpgrades?.preparation || 0) + (state.fieldRewards?.preparationBoost ? 1 : 0);
    if (state.tradition === 'translation') level += 1;
    if (legacy.foundationalMethods) level += 1;
    const cap = currentField(state)?.preparationCap ?? 6;
    return Math.max(0, Math.min(6, cap, level));
  }

  function projectStrength(state) {
    const scholar = state.specialization === 'scholar' ? (state.tradition === 'translation' ? 1.22 : 1.2) : 1;
    const teaching = state.tradition === 'teaching' ? 1.30 : 1;
    return scholar * teaching * (currentField(state)?.projectMultiplier || 1);
  }

  function networkInfrastructureMultiplier(state) { return 1.35 ** (state.netUpgrades?.infrastructure || 0); }

  function allocationLimits(state) {
    const field = currentField(state);
    const baseCap = Math.min(0.95, (state.fieldRewards?.allocationCap ?? 0.70) + (state.tradition === 'distribution' ? 0.05 : 0));
    return {
      cap: Math.min(baseCap, field?.allocationCap ?? 1),
      localCap: Math.min(baseCap, field?.localCap ?? 1),
      internationalCap: Math.min(baseCap, field?.internationalCap ?? 1),
      digitalMin: field?.digitalMin ?? 0
    };
  }

  function isAllocationValid(state, allocation) {
    const a = allocation || state.allocation;
    const lim = allocationLimits(state);
    const keys = ['local','regional','international','digital'];
    if (keys.some(k => !Number.isFinite(Number(a[k])) || Number(a[k]) < -1e-9)) return false;
    const sum = keys.reduce((x,k) => x + Number(a[k]), 0);
    return Math.abs(sum - 1) < 1e-6 &&
      Number(a.local) <= lim.localCap + 1e-9 && Number(a.international) <= lim.internationalCap + 1e-9 &&
      keys.every(k => Number(a[k]) <= lim.cap + 1e-9) && Number(a.digital) + 1e-9 >= lim.digitalMin;
  }

  function normalizeAllocation(allocation) {
    const keys = ['local','regional','international','digital'];
    const a = Object.fromEntries(keys.map(k => [k, Math.max(0, Number(allocation?.[k]) || 0)]));
    const total = keys.reduce((x,k) => x + a[k], 0) || 1;
    for (const k of keys) a[k] /= total;
    return a;
  }

  function setAllocation(state, allocation) {
    const next = normalizeAllocation(allocation);
    if (!isAllocationValid(state, next)) return false;
    state.allocation = next;
    return true;
  }

  function allocationSynergies(state, allocation = null) {
    if (state.networks === 0 && state.lifetimeNc.isZero) {
      return { recoveryBridge: 1, insightBridge: 1, projectBridge: 1, localRegional: 0, internationalDigital: 0, regionalDigital: 0 };
    }
    const a = allocation || state.allocation;
    const localRegional = Math.sqrt(Math.max(0, a.local * a.regional));
    const internationalDigital = Math.sqrt(Math.max(0, a.international * a.digital));
    const regionalDigital = Math.sqrt(Math.max(0, a.regional * a.digital));
    return {
      localRegional,
      internationalDigital,
      regionalDigital,
      recoveryBridge: 1 + (state.tradition === 'distribution' ? 0.30 : 0.25) * localRegional,
      insightBridge: 1 + (state.tradition === 'distribution' ? 0.24 : 0.20) * internationalDigital,
      projectBridge: 1 + (state.tradition === 'distribution' ? 0.18 : 0.15) * regionalDigital
    };
  }

  function allocationEffects(state) {
    if (state.networks === 0 && state.lifetimeNc.isZero) return { local: 1, regional: 1, international: 1, digitalProjectDivisor: 1, synergies: allocationSynergies(state) };
    const a = state.allocation;
    const synergies = allocationSynergies(state, a);
    // Regional capacity makes Local recovery last a little longer; Local in turn
    // slightly improves the steady Regional lane. International + Digital form a
    // bounded Translation bridge, and Regional + Digital cooperate on Projects.
    const localDecay = 600 * synergies.recoveryBridge;
    const local = 1 + 4 * (a.local ** 0.8) * Math.exp(-state.networkRunTime / localDecay);
    const regional = (1 + 2 * (a.regional ** 0.8)) * (1 + 0.10 * synergies.localRegional) * (state.fieldRewards?.regionalBonus || 1);
    const international = (1 + 1.5 * (a.international ** 0.8)) * synergies.insightBridge * (state.fieldRewards?.internationalBonus || 1);
    const digitalProjectDivisor = 1 / (1 + 2 * (a.digital ** 0.7) * synergies.projectBridge);
    return { local, regional, international, digitalProjectDivisor, synergies };
  }

  function networkThreshold(state = null) { return state ? effectiveNetworkThreshold(state) : NETWORK_BASE_THRESHOLD.clone(); }

  function networkGain(state) {
    const threshold = effectiveNetworkThreshold(state);
    if (state.tiThisNetwork.lt(threshold)) return bn(0);
    let raw = state.tiThisNetwork.div(threshold).pow(0.30);
    if (state.networks > 0) {
      const readiness = Math.min(1, Math.max(0.30, (state.networkRunTime / 7200) ** 1.10));
      raw = raw.mul(readiness);
    }
    return raw.floor();
  }

  function networkReadiness(state) {
    const threshold = effectiveNetworkThreshold(state);
    if (state.tiThisNetwork.lt(threshold)) return { status: 'locked', label: 'Building', score: Math.min(1, state.tiThisNetwork.div(threshold).toNumber()), recommendation: `Earn ${threshold.format(0)} TI during this Network cycle.` };
    const gain = networkGain(state);
    if (state.networks === 0) return { status: 'mature', label: 'Network ready', score: 1, recommendation: 'The first Network can now be established.' };
    const readiness = Math.min(1, Math.max(0.30, (state.networkRunTime / 7200) ** 1.10));
    if (gain.lt(1)) return { status: 'early', label: 'Compressed', score: readiness, recommendation: 'The Network threshold is reached, but this short cycle is still too compressed to award 1 NC. Let the cycle mature or earn more TI.' };
    if (readiness < 0.55) return { status: 'early', label: 'Compressed', score: readiness, recommendation: 'Short Network cycles are compressed. Two hours reaches full Network readiness.' };
    if (readiness < 1) return { status: 'developing', label: 'Developing', score: readiness, recommendation: 'Network readiness is still improving toward its two-hour target.' };
    return { status: 'mature', label: 'Full readiness', score: 1, recommendation: 'This Network receives the full reward formula.' };
  }

  function networkEfficiency(state) {
    const gain = networkGain(state).toNumber();
    const hours = Math.max(1/3600, state.networkRunTime / 3600);
    return gain / hours;
  }

  function networkUpgradeDef(id) { return NETWORK_UPGRADES.find(x => x.id === id); }

  function networkUpgradeCost(state, id) {
    const def = networkUpgradeDef(id);
    if (!def) return null;
    if (def.repeatable) {
      const level = state.netUpgrades.infrastructure || 0;
      if (level >= def.maxLevel) return null;
      return bn(def.baseCost * (def.costGrowth ** level));
    }
    return state.netOneTime[id] ? null : bn(def.cost);
  }

  function buyNetworkUpgrade(state, id) {
    const def = networkUpgradeDef(id);
    const cost = networkUpgradeCost(state, id);
    if (!def || !cost || state.nc.lt(cost)) return false;
    state.nc = state.nc.sub(cost);
    if (def.repeatable) state.netUpgrades.infrastructure++;
    else state.netOneTime[id] = true;
    return true;
  }

  function saveNetworkPreset(state, slot) {
    if (!state.netOneTime.distributionNotes) return false;
    const idx = Number(slot) - 1;
    if (idx < 0 || idx >= state.networkPresets.length) return false;
    state.networkPresets[idx] = { ...state.networkPresets[idx], saved: true, allocation: { ...state.allocation } };
    return true;
  }

  function loadNetworkPreset(state, slot) {
    if (!state.netOneTime.distributionNotes) return false;
    const preset = state.networkPresets[Number(slot)-1];
    if (!preset?.saved) return false;
    return setAllocation(state, preset.allocation);
  }

  function pageProduction(state, breakdown = null) {
    let total = bn(2);
    const alloc = allocationEffects(state);
    const field = currentField(state);
    const global = globalUpgradeMultiplier(state) * workflowMultiplier(state) * scholarMultiplier(state) * networkInfrastructureMultiplier(state) * legacyPowerMultiplier(state) * alloc.local * alloc.regional * (field?.pageMultiplier || 1);

    for (let i = 0; i < PRODUCERS.length; i++) {
      const def = PRODUCERS[i];
      const owned = state.producers[def.id] || 0;
      if (owned <= 0) continue;
      let mult = global * milestoneMultiplier(owned, state) * (field?.directProducerMultiplier || 1);
      if (def.id === 'teacher') mult *= field?.teacherMultiplier || 1;
      const up = PAGE_UPGRADES.find(x => x.target === def.id);
      if (up && state.pageUpgrades[up.id]) mult *= up.mult;
      if (i < PRODUCERS.length - 1) {
        const higherOwned = state.producers[PRODUCERS[i + 1].id] || 0;
        mult *= (1 + higherOwned / 25) ** synergyExponent(state, def.id);
      }
      const contribution = bn(def.production * owned * mult);
      if (breakdown) breakdown[def.id] = contribution;
      total = total.add(contribution);
    }

    const strength = projectStrength(state);
    if (state.projects.manuscript) total = total.mul(1 + 0.5 * strength);
    if (state.projects.teaching) total = total.mul(1 + 1.0 * strength);
    if (breakdown) for (const id of Object.keys(breakdown)) {
      if (state.projects.manuscript) breakdown[id] = breakdown[id].mul(1 + 0.5 * strength);
      if (state.projects.teaching) breakdown[id] = breakdown[id].mul(1 + strength);
    }
    return total;
  }

  function translationThreshold(state) {
    return TRANSLATION_THRESHOLD.mul(currentField(state)?.translationThresholdMultiplier || 1);
  }

  function translationGain(state) {
    const threshold = translationThreshold(state);
    if (state.peakPages.lt(threshold)) return bn(0);
    let raw = state.peakPages.div(threshold).pow(TRANSLATION_EXPONENT);
    raw = softcap(raw, '1e6', 0.65);
    raw = softcap(raw, '1e12', 0.45);
    raw = raw.mul(allocationEffects(state).international * (currentField(state)?.tiMultiplier || 1));
    raw = raw.mul(specializationTiMultiplier(state));
    if (state.translations > 0) {
      const target = translationReadinessTarget(state);
      const readiness = Math.min(1, Math.max(0.25, (state.runTime / target) ** 1.2));
      raw = raw.mul(readiness);
    }
    return raw.floor();
  }

  function translationReadiness(state) {
    const threshold = translationThreshold(state);
    if (state.peakPages.lt(threshold)) return { status: 'locked', label: 'Not ready', score: 0, recommendation: `Reach ${threshold.format(2)} peak Pages.` };
    const gain = translationGain(state);
    if (state.translations === 0) {
      const minutes = state.runTime / 60;
      if (minutes < 20) return { status: 'early', label: 'Early', score: Math.min(0.75, minutes / 30), recommendation: 'You can Translate now, but the first run is usually more efficient around 20–30 minutes, or on your next visit.' };
      if (minutes < 25) return { status: 'developing', label: 'Developing', score: 0.82, recommendation: 'Close to the intended first-run window.' };
      return { status: 'mature', label: 'Mature', score: 1, recommendation: 'This run is in the intended first-Translation window.' };
    }
    const target = translationReadinessTarget(state);
    const readiness = Math.min(1, Math.max(0.25, (state.runTime / target) ** 1.2));
    if (gain.lt(1)) return { status: 'early', label: 'Compressed', score: readiness, recommendation: 'The Translation threshold is reached, but this repeat run is still too compressed to award 1 TI. Wait longer or build a higher peak.' };
    if (readiness < 0.55) return { status: 'early', label: 'Compressed', score: readiness, recommendation: 'Very short repeat runs receive readiness compression. Waiting improves TI efficiency.' };
    if (readiness < 1) return { status: 'developing', label: 'Developing', score: readiness, recommendation: `TI readiness is still rising toward full value at ${(target/60).toFixed(target % 60 ? 1 : 0)} minutes${state.specialization === 'publisher' ? ' with Publisher' : ''}.` };
    return { status: 'mature', label: 'Full readiness', score: 1, recommendation: 'This run receives the full Translation reward formula.' };
  }

  function translationEfficiency(state) {
    const gain = translationGain(state).toNumber();
    const mins = Math.max(1 / 60, state.runTime / 60);
    return gain / mins;
  }

  // Ignore sub-picolog rounding at affordability boundaries; never advances a meaningful purchase.
  function canAfford(balance, cost) { return balance.gte(cost) || (!balance.isZero && cost.log10 - balance.log10 <= 1e-12); }
  function buyProducer(state, id, quantity = 1) {
    const def = producerDef(id);
    if (!def) return { bought: 0, spent: bn(0) };
    const max = quantity === 'max' ? 100000 : Math.max(0, Math.floor(quantity));
    let bought = 0;
    let spent = bn(0);
    while (bought < max) {
      const cost = producerCost(def, state.producers[id], state);
      if (!canAfford(state.pages,cost)) break;
      state.pages = state.pages.sub(cost);
      state.producers[id]++;
      spent = spent.add(cost);
      bought++;
    }
    if (bought) rememberSettlement(state, 'buildings', id, state.producers[id]);
    if (bought && state.records.firstPurchaseAt === null) state.records.firstPurchaseAt = state.timePlayed;
    return { bought, spent };
  }

  function maxAffordableProducerCount(state, id, hardCap = 100000) {
    const def = producerDef(id);
    if (!def) return 0;
    let resources = state.pages.clone();
    let owned = state.producers[id];
    let count = 0;
    while (count < hardCap) {
      const cost = producerCost(def, owned, state);
      if (!canAfford(resources,cost)) break;
      resources = resources.sub(cost);
      owned++;
      count++;
    }
    return count;
  }

  function buyPageUpgrade(state, id) {
    const def = upgradeDef(id);
    if (!def || state.pageUpgrades[id]) return false;
    const cost = bn(def.cost);
    if (!canAfford(state.pages,cost)) return false;
    state.pages = state.pages.sub(cost);
    state.pageUpgrades[id] = 1;
    rememberSettlement(state, 'methods', id, true);
    if (state.records.firstUpgradeAt === null) state.records.firstUpgradeAt = state.timePlayed;
    return true;
  }

  function projectThreshold(state, id) {
    const def = projectDef(id);
    if (!def?.peak) return bn(0);
    const teacherFactor = state.specialization === 'teacher' ? 0.80 : 1;
    const digital = allocationEffects(state).digitalProjectDivisor;
    return bn(def.peak).mul(teacherFactor * digital);
  }

  function projectVisible(state, id) {
    const def = projectDef(id);
    if (!def) return false;
    if (state.projects[id]) return true;
    if (effectivePreparationLevel(state) >= 4 || legacyMilestones(state).projectsVisible) return true;
    const threshold = projectThreshold(state, id);
    if (id === 'manuscript') return !!state.pageUpgrades.desk || state.peakPages.gte(threshold.div(5));
    if (id === 'reference') return !!state.projects.manuscript || state.producers.editor > 0 || state.peakPages.gte(threshold.div(5));
    if (id === 'teaching') return (!!state.projects.manuscript && !!state.projects.reference) || state.producers.teacher > 0 || state.peakPages.gte(threshold.div(5));
    return true;
  }

  function projectStatus(state, id) {
    const def = projectDef(id);
    if (!def) return { available: false, reasons: ['Unknown Project'] };
    if (state.projects[id]) return { available: false, complete: true, reasons: [] };
    const reasons = [];
    const threshold = projectThreshold(state, id);
    if (def.peak && state.peakPages.lt(threshold)) reasons.push(`Peak Pages ${threshold.format(2)}`);
    if (def.editors && state.producers.editor < def.editors) reasons.push(`${def.editors} Editors`);
    if (def.teachers && state.producers.teacher < def.teachers) reasons.push(`${def.teachers} Teachers`);
    for (const req of def.requires || []) if (!state.projects[req]) reasons.push(`${projectDef(req).name}`);
    if (id === 'manuscript' && state.pages.isZero) reasons.push('Some current Pages to invest');
    return { available: reasons.length === 0, complete: false, reasons };
  }

  function completeProject(state, id) {
    const status = projectStatus(state, id);
    if (!status.available) return false;
    if (id === 'manuscript') state.pages = state.pages.sub(state.pages.mul(Math.min(0.20, 0.20 * allocationEffects(state).digitalProjectDivisor)));
    state.projects[id] = true;
    rememberSettlement(state, 'commissions', id, true);
    if (state.field?.active && !state.field.stats.projects.includes(id)) state.field.stats.projects.push(id);
    if (state.records.firstProjectAt === null) state.records.firstProjectAt = state.timePlayed;
    return true;
  }

  function preparationEffect(level) {
    const effects = [
      'No retained setup yet.',
      'Start each Translation run with 10 Scribes.',
      'Also start with 10 Copyists.',
      'Retain Organized Desk and Copying Methods.',
      'Projects are visible immediately; requirements are unchanged.',
      'Start with at least 25 Scribes and 25 Copyists.',
      'Also retain Editorial Standards and Teaching Framework.'
    ];
    return effects[Math.max(0, Math.min(6, level))];
  }

  function applyPreparation(state, legacyOverride = null) {
    const level = effectivePreparationLevel(state, legacyOverride);
    const legacy = legacyMilestones(state, legacyOverride);
    if (level >= 1) state.producers.scribe = 10;
    if (level >= 2) state.producers.copyist = 10;
    if (level >= 3) { state.pageUpgrades.desk = 1; state.pageUpgrades.copying = 1; }
    if (level >= 5) { state.producers.scribe = Math.max(25, state.producers.scribe); state.producers.copyist = Math.max(25, state.producers.copyist); }
    if (level >= 6) { state.pageUpgrades.editorial = 1; state.pageUpgrades.teaching = 1; }
    if (legacy.foundationalMethods) { state.pageUpgrades.desk = 1; state.pageUpgrades.copying = 1; state.pageUpgrades.editorial = 1; }
    if (state.netOneTime?.localPartnership) {
      state.producers.scribe = Math.max(25, state.producers.scribe);
      state.producers.copyist = Math.max(10, state.producers.copyist);
    }
    if (state.netOneTime?.coordinatedMethods || state.fieldRewards?.firstProjectRetained) {
      state.projects.manuscript = true;
      if (state.field?.active && !state.field.stats.projects.includes('manuscript')) state.field.stats.projects.push('manuscript');
    }
  }

  function resetBase(state, legacyOverride = null) {
    // Canonical mastery retires solved automation setup for the rotating Mature Fields.
    if (fieldClearCounts(state).total >= FIELDS.length) {
      for (const id of ['basicAutomation','fullAutomation','projectQueue','presets','translationAutomation']) state.tiOneTime[id] = true;
      state.automation.basic = state.automation.full = state.automation.projects = state.automation.translation = true;
    }
    state.pages = bn(0);
    state.peakPages = bn(0);
    state.producers = zeroMap(PRODUCERS.map(x => x.id));
    state.pageUpgrades = zeroMap(PAGE_UPGRADES.map(x => x.id));
    state.projects = { manuscript: false, reference: false, teaching: false };
    state.runTime = 0;
    applyPreparation(state, legacyOverride);
    if (state.queuedSpecialization && SPECIALIZATIONS.some(x => x.id === state.queuedSpecialization)) {
      state.specialization = state.queuedSpecialization;
      state.queuedSpecialization = null;
    }
  }

  function completeTranslation(state, automated = false) {
    const gain = translationGain(state);
    if (gain.lt(1)) return { ok: false, gain: bn(0) };
    const duration = state.runTime;
    state.ti = state.ti.add(gain);
    state.lifetimeTi = state.lifetimeTi.add(gain);
    state.tiThisNetwork = state.tiThisNetwork.add(gain);
    state.translations += 1;
    if (state.field?.active) state.field.stats.translations += 1;
    if (state.records.firstTranslationAt === null) state.records.firstTranslationAt = state.timePlayed;
    if (state.records.specializationUnlockedAt === null && state.lifetimeTi.gte(SPECIALIZATION_UNLOCK_LIFETIME_TI)) state.records.specializationUnlockedAt = state.timePlayed;
    state.records.fastestTranslation = state.records.fastestTranslation == null ? duration : Math.min(state.records.fastestTranslation, duration);
    state.records.bestTranslationGain = state.records.bestTranslationGain.max(gain);
    state.records.recentTranslations.unshift({ at: state.timePlayed, duration, gain: gain.clone(), automated, specialization: state.specialization });
    state.records.recentTranslations = state.records.recentTranslations.slice(0, 12);
    state.records.lastTranslationGain = gain.clone();
    resetBase(state);
    updatePhase2Completion(state);
    return { ok: true, gain, duration, automated };
  }

  function resetTranslationLayerForNetwork(state) {
    state.records.lastTranslationGain = bn(0);
    if (!state.netOneTime.persistentWorkflow && !legacyMilestones(state).buyMax) state.purchaseQueue.orders = [];
    const legacy = legacyMilestones(state);
    state.ti = state.netOneTime.matureNetwork || legacy.firstTranslationCompressed ? bn(10) : bn(0);
    state.tiUpgrades = { workflow: 0, training: 0, preparation: state.netOneTime.trainingContinuity ? 2 : 0 };
    state.tiOneTime = Object.fromEntries(TI_ONE_TIMES.map(x => [x.id, false]));
    if (state.netOneTime.persistentWorkflow || legacy.buyMax) state.tiOneTime.buyMax = true;
    if (legacy.translationUnlocked) {
      state.tiOneTime.standardTerminology = true;
      state.tiOneTime.reusableTemplates = true;
      state.tiOneTime.consistentWorkflow = true;
    }
    // Establishing the first Network permanently solves manual base purchasing.
    // Network resets still rebuild Projects and Translation automation until later retention upgrades.
    state.tiOneTime.basicAutomation = true;
    state.tiOneTime.fullAutomation = true;
    if (legacy.buyMax) state.tiOneTime.buyMax = true;
    if (legacy.translationUnlocked) {
      state.tiOneTime.standardTerminology = true;
      state.tiOneTime.reusableTemplates = true;
      state.tiOneTime.consistentWorkflow = true;
    }
    state.automation.basic = true;
    state.automation.full = true;
    state.automation.projects = false;
    state.automation.translation = false;
    if (state.netOneTime.persistentAutomation) {
      state.tiOneTime.projectQueue = true;
      state.automation.projects = true;
    }
    if (state.netOneTime.translationContinuity) {
      state.tiOneTime.translationAutomation = true;
      state.automation.translation = true;
    }
    resetBase(state);
  }

  function completeNetwork(state) {
    const gain = networkGain(state);
    if (gain.lt(1)) return { ok: false, gain: bn(0) };
    const duration = state.networkRunTime;
    state.nc = state.nc.add(gain);
    state.lifetimeNc = state.lifetimeNc.add(gain);
    state.ncThisField = state.ncThisField.add(gain);
    state.networks += 1;
    state.records.firstNetworkAt ??= state.timePlayed;
    state.records.fastestNetwork = state.records.fastestNetwork == null ? duration : Math.min(state.records.fastestNetwork, duration);
    state.records.bestNetworkGain = state.records.bestNetworkGain.max(gain);
    state.records.recentNetworks.unshift({ at: state.timePlayed, duration, gain: gain.clone(), tiEarned: state.tiThisNetwork.clone(), allocation: { ...state.allocation } });
    state.records.recentNetworks = state.records.recentNetworks.slice(0, 12);
    if (state.field?.active) {
      state.field.stats.networks += 1;
      state.field.stats.allocations.push({ ...state.allocation });
      if (isAllocationValid(state, state.allocation)) {
        state.field.stats.validNetworks += 1;
        state.field.progressNc = state.field.progressNc.add(gain);
      }
    }
    state.tiThisNetwork = bn(0);
    state.networkRunTime = 0;
    resetTranslationLayerForNetwork(state);
    updatePhase3Completion(state);
    return { ok: true, gain, duration };
  }

  function fieldUnlocked(state) {
    return state.lifetimeNc.gte(FIELD_UNLOCK_LIFETIME_NC) && state.ncThisField.gte(1);
  }

  function recommendedFieldAllocation(field = null) {
    const id = field?.id || null;
    if (id === 'remote') return { local: .20, regional: .30, international: .30, digital: .20 };
    if (id === 'remote-ii') return { local: .10, regional: .35, international: .30, digital: .25 };
    if (id === 'urban-ii') return { local: .25, regional: .25, international: .25, digital: .25 };
    if (id === 'multilingual-ii') return { local: .20, regional: .30, international: .30, digital: .20 };
    if (id === 'frontier-iii' || id === 'urban') return { local: .25, regional: .25, international: .25, digital: .25 };
    if (id === 'mature-field') {
      if (field?.patternId === 'translation') return { local:.15, regional:.25, international:.45, digital:.15 };
      if (field?.patternId === 'distribution') return { local:.25, regional:.30, international:.25, digital:.20 };
      if (field?.patternId === 'integration') return { local:.20, regional:.30, international:.25, digital:.25 };
      return { local:.35, regional:.30, international:.20, digital:.15 };
    }
    return { local: .25, regional: .30, international: .30, digital: .15 };
  }

  function fieldObjectiveStatus(state, field = currentField(state)) {
    if (!field) return { met: false, items: [] };
    const req = field.objective || {};
    const items = [
      { id: 'nc', label: `Valid NC ${state.field.progressNc.format(0)} / ${fieldThreshold(state, field).format(0)}`, met: state.field.progressNc.gte(fieldThreshold(state, field)) },
      { id: 'networks', label: `Valid Networks ${state.field.stats.validNetworks} / ${req.validNetworks || 0}`, met: state.field.stats.validNetworks >= (req.validNetworks || 0) }
    ];
    if (req.translations) items.push({ id: 'translations', label: `Translations ${state.field.stats.translations} / ${req.translations}`, met: state.field.stats.translations >= req.translations });
    if (field.requireAllProjects) items.push({ id: 'projects', label: `Projects ${state.field.stats.projects.length} / 3`, met: state.field.stats.projects.length >= 3 });
    return { met: items.every(x => x.met), items };
  }

  function fieldReward(state) {
    const field = currentField(state);
    if (!field || !fieldObjectiveStatus(state, field).met) return bn(0);
    // Rewards are fixed by the completed objective, not by farming excess NC after completion.
    return fieldThreshold(state, field).pow(0.35).mul(field.difficulty * FIELD_REWARD_SCALE).floor().max(1);
  }

  function autoTranslationAllowed(state) {
    const gate = currentField(state)?.autoTranslationTiGate || 0;
    return state.tiThisNetwork.gte(gate);
  }

  function resetLowerLayersForField(state) {
    state.records.lastTranslationGain = bn(0);
    if (!legacyMilestones(state).buyMax) state.purchaseQueue.orders = [];
    const legacy = legacyMilestones(state);
    state.ti = legacy.firstTranslationCompressed ? bn(10) : bn(0);
    state.tiThisNetwork = bn(0);
    state.tiUpgrades = { workflow: 0, training: 0, preparation: 0 };
    state.tiOneTime = Object.fromEntries(TI_ONE_TIMES.map(x => [x.id, false]));
    // By the Field era base purchasing is solved permanently; higher automation must be re-earned unless a Field reward retains it.
    state.tiOneTime.basicAutomation = true;
    state.tiOneTime.fullAutomation = true;
    if (legacy.buyMax) state.tiOneTime.buyMax = true;
    if (legacy.translationUnlocked) {
      state.tiOneTime.standardTerminology = true;
      state.tiOneTime.reusableTemplates = true;
      state.tiOneTime.consistentWorkflow = true;
    }
    state.automation.basic = true;
    state.automation.full = true;
    state.automation.projects = false;
    state.automation.translation = false;
    if (state.fieldRewards.persistentAutomation) {
      state.tiOneTime.projectQueue = true;
      state.automation.projects = true;
    }
    const legacyNc = legacy.networkRecovery ? Math.max(5, Math.floor(state.lifetimeLegacy.toNumber() / 10)) : 0;
    state.nc = bn(Math.max(state.fieldRewards.networkStartNc || 0, legacyNc));
    state.networkRunTime = 0;
    state.netUpgrades = { infrastructure: state.tradition === 'distribution' ? 1 : 0 };
    state.netOneTime = Object.fromEntries(NETWORK_UPGRADES.filter(x => !x.repeatable).map(x => [x.id, false]));
    state.allocation = recommendedFieldAllocation(currentField(state));
    resetBase(state);
  }

  function canEnterField(state, fieldId = null) {
    if (state.field.active || state.campaign?.complete || state.lifetimeNc.lt(FIELD_UNLOCK_LIFETIME_NC)) return false;
    const field = fieldId ? (FIELDS.find(f => f.id === fieldId) || (fieldId === MATURE_FIELD.id ? matureFieldForState(state) : null)) : nextField(state);
    if (!field || !fieldEligibility(state, field)) return false;
    const continuity = legacyMilestones(state).fieldRetention || (state.tradition === 'pioneer' && state.legacies > 0);
    return continuity || state.ncThisField.gte(1);
  }

  function enterField(state, fieldId = null) {
    const field = fieldId ? (FIELDS.find(f => f.id === fieldId) || (fieldId === MATURE_FIELD.id ? matureFieldForState(state) : null)) : nextField(state);
    if (!field || !canEnterField(state, field.id)) return { ok: false };
    state.field.active = true;
    state.field.activeId = field.id;
    state.field.progressNc = bn(0);
    state.field.enteredAt = state.timePlayed;
    state.field.stats = { translations: 0, networks: 0, validNetworks: 0, projects: [], allocations: [] };
    state.ncThisField = bn(0);
    state.records.firstFieldAt ??= state.timePlayed;
    resetLowerLayersForField(state);
    return { ok: true, field };
  }

  function applyFieldReward(state, field) {
    if (!field) return;
    if (field.id === 'urban') state.fieldRewards.allocationCap = Math.max(state.fieldRewards.allocationCap, 0.75);
    if (field.id === 'remote') state.fieldRewards.preparationBoost = true;
    if (field.id === 'oral') state.fieldRewards.firstProjectRetained = true;
    if (field.id === 'restricted') state.fieldRewards.persistentAutomation = true;
    if (field.id === 'multilingual') state.fieldRewards.internationalBonus *= 1.15;
    if (field.id === 'urban-ii') state.fieldRewards.regionalBonus *= 1.10;
    if (field.id === 'remote-ii') state.fieldRewards.networkStartNc = Math.max(2, state.fieldRewards.networkStartNc);
    if (field.id === 'multilingual-ii') state.fieldRewards.internationalBonus *= 1.10;
    if (field.id === 'frontier-iii') state.fieldRewards.fieldThresholdMult *= 0.90;
  }

  function completeField(state) {
    const field = currentField(state);
    const gain = fieldReward(state);
    if (!field || gain.lt(1)) return { ok: false, gain: bn(0) };
    const duration = state.timePlayed - state.field.enteredAt;
    const attempt = {
      id: field.id, name: field.name, tier: field.tier, enteredAt: state.field.enteredAt, at: state.timePlayed, duration, gain: gain.clone(),
      translations: state.field.stats.translations, networks: state.field.stats.networks, validNetworks: state.field.stats.validNetworks,
      projects: [...state.field.stats.projects], progressNc: state.field.progressNc.clone(), allocations: state.field.stats.allocations.map(a => ({ ...a }))
    };
    state.fe = state.fe.add(gain);
    state.lifetimeFe = state.lifetimeFe.add(gain);
    state.feThisLegacy = state.feThisLegacy.add(gain);
    if (!field.repeatable) {
      if (!state.field.cleared.includes(field.id)) state.field.cleared.push(field.id);
      state.field.index = state.field.cleared.length;
      const counts = fieldClearCounts(state);
      state.campaign.tier1 = counts.tier1;
      state.campaign.tier2 = counts.tier2;
      state.campaign.tier3 = counts.tier3;
      applyFieldReward(state, field);
    }
    state.records.firstFieldClearAt ??= state.timePlayed;
    state.records.recentFields.unshift(attempt);
    state.records.recentFields = state.records.recentFields.slice(0, 12);
    if (field.repeatable) state.field.matureClears += 1;
    state.field.active = false;
    state.field.activeId = null;
    state.field.progressNc = bn(0);
    state.field.enteredAt = null;
    state.field.stats = { translations: 0, networks: 0, validNetworks: 0, projects: [], allocations: [] };
    state.ncThisField = bn(0);
    resetLowerLayersForField(state);
    updatePhase4Completion(state);
    return { ok: true, gain, field, duration };
  }

  function legacyReady(state) { return Math.round(state.feThisLegacy.toNumber()) >= Math.round(LEGACY_UNLOCK_FE.toNumber()); }

  function legacyReadiness(state) {
    if (!legacyReady(state)) {
      return { status: 'locked', label: 'Building', score: Math.min(1, state.feThisLegacy.div(LEGACY_UNLOCK_FE).toNumber()), factor: 0, recommendation: `Accumulate ${LEGACY_UNLOCK_FE.format(0)} FE during this Legacy era.` };
    }
    if (state.legacies === 0) {
      return { status: 'mature', label: 'Legacy ready', score: 1, factor: 1, recommendation: 'The first Legacy receives the full reward formula.' };
    }
    const factor = Math.min(1, Math.max(0.25, (state.legacyRunTime / LEGACY_READINESS_TARGET_SECONDS) ** 1.2));
    if (factor < 0.55) return { status: 'early', label: 'Compressed', score: factor, factor, recommendation: 'Short repeat Legacy eras are compressed. Thirty hours reaches full Legacy readiness.' };
    if (factor < 1) return { status: 'developing', label: 'Developing', score: factor, factor, recommendation: 'Legacy readiness is still improving toward its thirty-hour target.' };
    return { status: 'mature', label: 'Full readiness', score: 1, factor: 1, recommendation: 'This era receives the full repeat-Legacy reward formula.' };
  }

  function legacyGain(state) {
    if (!legacyReady(state)) return bn(0);
    const normalizedFe = bn(Math.max(LEGACY_UNLOCK_FE.toNumber(), Math.round(state.feThisLegacy.toNumber())));
    let raw = normalizedFe.div(LEGACY_UNLOCK_FE).pow(LEGACY_EXPONENT).mul(LEGACY_SCALE);
    if (state.legacies > 0) raw = raw.mul(legacyReadiness(state).factor);
    return raw.floor().max(1);
  }

  function legacyEfficiency(state) {
    const gain = legacyGain(state).toNumber();
    const days = Math.max(1/86400, state.legacyRunTime / 86400);
    return gain / days;
  }

  function resetForLegacy(state, milestoneBasis = null) {
    if (!legacyMilestones(state, milestoneBasis).buyMax) state.purchaseQueue.orders = [];
    if (state.queuedTradition && traditionDef(state.queuedTradition)) {
      state.tradition = state.queuedTradition;
      state.queuedTradition = null;
    }
    const legacy = legacyMilestones(state, milestoneBasis);
    state.fe = bn(0);
    state.feThisLegacy = bn(0);
    state.ncThisField = bn(0);
    state.tiThisNetwork = bn(0);
    state.records.lastTranslationGain = bn(0);
    state.ti = legacy.firstTranslationCompressed ? bn(10) : bn(0);
    state.nc = bn(legacy.networkRecovery ? Math.max(5, Math.floor(state.lifetimeLegacy.toNumber() / 10)) : 0);
    state.networkRunTime = 0;
    state.runTime = 0;
    state.tiUpgrades = { workflow: 0, training: 0, preparation: 0 };
    state.tiOneTime = Object.fromEntries(TI_ONE_TIMES.map(x => [x.id, false]));
    if (legacy.buyMax) state.tiOneTime.buyMax = true;
    if (legacy.translationUnlocked) {
      state.tiOneTime.standardTerminology = true;
      state.tiOneTime.reusableTemplates = true;
      state.tiOneTime.consistentWorkflow = true;
    }
    state.automation.basic = legacy.automation;
    state.automation.full = legacy.automation;
    state.automation.projects = false;
    state.automation.translation = false;
    if (legacy.automation) { state.tiOneTime.basicAutomation = true; state.tiOneTime.fullAutomation = true; }
    state.netUpgrades = { infrastructure: state.tradition === 'distribution' ? 1 : 0 };
    state.netOneTime = Object.fromEntries(NETWORK_UPGRADES.filter(x => !x.repeatable).map(x => [x.id, false]));
    if (legacy.networkPresets) state.netOneTime.distributionNotes = true;
    else state.networkPresets = [emptyNetworkPreset(1), emptyNetworkPreset(2), emptyNetworkPreset(3)];
    if (!legacy.specializationRetained) state.specialization = null;
    state.queuedSpecialization = null;
    state.field.active = false;
    state.field.activeId = null;
    state.field.progressNc = bn(0);
    state.field.enteredAt = null;
    state.field.stats = { translations: 0, networks: 0, validNetworks: 0, projects: [], allocations: [] };
    state.allocation = recommendedFieldAllocation(null);
    resetBase(state, milestoneBasis);
  }

  function completeLegacy(state) {
    const gain = legacyGain(state);
    if (gain.lt(1)) return { ok: false, gain: bn(0) };
    const duration = state.legacyRunTime;
    const fe = state.feThisLegacy.clone();
    const milestoneBasis = state.lifetimeLegacy.clone();
    state.legacy = state.legacy.add(gain);
    state.lifetimeLegacy = state.lifetimeLegacy.add(gain);
    state.legacies += 1;
    state.records.firstLegacyAt ??= state.timePlayed;
    state.records.fastestLegacy = state.records.fastestLegacy == null ? duration : Math.min(state.records.fastestLegacy, duration);
    state.records.bestLegacyGain = state.records.bestLegacyGain.max(gain);
    state.records.recentLegacies.unshift({ at: state.timePlayed, duration, gain: gain.clone(), fe, fieldIndex: state.field.index, matureClears: state.field.matureClears });
    state.records.recentLegacies = state.records.recentLegacies.slice(0, 12);
    state.legacyRunTime = 0;
    resetForLegacy(state, milestoneBasis);
    updateLibraryUnlocks(state);
    updatePhase5Completion(state);
    return { ok: true, gain, duration, fe };
  }

  function finalSequenceAvailable(state) {
    const legacy = legacyMilestones(state);
    return legacy.finalSequence && state.campaign.tier1 >= 5 && state.campaign.tier2 >= 3 && state.campaign.tier3 >= 1 && state.field.matureClears >= MATURE_FIELD_PATTERNS.length;
  }

  function completeCampaign(state) {
    if (!finalSequenceAvailable(state) || state.campaign.complete) return false;
    state.campaign.complete = true;
    state.phase5Complete = true;
    state.records.campaignCompleteAt ??= state.timePlayed;
    updateLibraryUnlocks(state);
    return true;
  }

  function scriptureCollectionUnlocked(state, id) {
    if (id === 'torah') return state.translations >= 1;
    if (id === 'history') return state.records.translationAutomationAt != null;
    if (id === 'wisdom') return state.networks >= 1;
    if (id === 'prophets') return state.field.index >= 1 || state.field.matureClears > 0;
    if (id === 'gospels') return state.field.index >= 3;
    if (id === 'acts') return state.campaign.tier1 >= 5;
    if (id === 'epistles') return state.legacies >= 1;
    if (id === 'revelation') return finalSequenceAvailable(state) || state.campaign.complete;
    return false;
  }

  function updateLibraryUnlocks(state) {
    state.library = state.library || {};
    for (const c of SCRIPTURE_COLLECTIONS) if (scriptureCollectionUnlocked(state, c.id)) state.library[c.id] = true;
    return state.library;
  }

  function repeatableCost(state, id) {
    const def = tiRepeatableDef(id);
    if (!def) return bn(0);
    const level = state.tiUpgrades[id] || 0;
    if (id === 'preparation') {
      if (level >= def.maxLevel) return null;
      return bn(def.fixedCosts[level]);
    }
    return bn(def.baseCost * (def.costGrowth ** level));
  }

  function buyTiRepeatable(state, id) {
    const def = tiRepeatableDef(id);
    if (!def) return false;
    const cost = repeatableCost(state, id);
    if (!cost || state.ti.lt(cost)) return false;
    state.ti = state.ti.sub(cost);
    state.tiUpgrades[id]++;
    updatePhase2Completion(state);
    return true;
  }

  function oneTimeAvailable(state, id) {
    const def = tiOneTimeDef(id);
    if (!def || state.tiOneTime[id]) return false;
    if (def.requires && !state.tiOneTime[def.requires]) return false;
    return true;
  }

  function buyTiOneTime(state, id) {
    const def = tiOneTimeDef(id);
    if (!oneTimeAvailable(state, id) || state.ti.lt(def.cost)) return false;
    state.ti = state.ti.sub(def.cost);
    state.tiOneTime[id] = true;
    const controls = state.automation.controls || { baseEnabled: true, projectsEnabled: true, translationEnabled: true };
    if (id === 'basicAutomation') { state.automation.basic = true; controls.baseEnabled = false; }
    if (id === 'fullAutomation') state.automation.full = true;
    if (id === 'projectQueue') { state.automation.projects = true; controls.projectsEnabled = false; }
    if (id === 'translationAutomation') {
      state.automation.translation = true;
      controls.translationEnabled = false;
      if (state.records.translationAutomationAt === null) state.records.translationAutomationAt = state.timePlayed;
    }
    state.automation.controls = controls;
    updatePhase2Completion(state);
    return true;
  }

  function specializationUnlocked(state) { return !!state.specialization || state.lifetimeTi.gte(SPECIALIZATION_UNLOCK_LIFETIME_TI); }

  function setSpecialization(state, id, { forNextRun = false } = {}) {
    if (!specializationUnlocked(state) || !SPECIALIZATIONS.some(x => x.id === id)) return false;
    if (!state.specialization) {
      state.specialization = id;
      rememberSettlement(state, 'onboarding', 'approach', true);
      if (state.records.specializationUnlockedAt === null) state.records.specializationUnlockedAt = state.timePlayed;
      return true;
    }
    if (state.specialization === id && !forNextRun) return true;
    state.queuedSpecialization = id;
    return true;
  }

  function hasBuyMax(state) { return true; }

  function shouldAutoTranslate(state) {
    if (!state.automation.translation || state.automation.controls?.translationEnabled === false || !state.automation.autoSettings.enabled || !autoTranslationAllowed(state)) return false;
    if (state.purchaseQueue?.orders?.length && !state.purchaseQueue.paused) return false;
    const gain = translationGain(state);
    if (gain.lt(1)) return false;
    const settings = state.automation.autoSettings;
    if (state.runTime < Math.max(1, Number(settings.minRun) || 90)) return false;
    const last = state.records.lastTranslationGain;
    if (last.isZero) return true;
    if (gain.gte(last.mul(Math.max(1, Number(settings.resetMultiple) || 1.35)))) return true;
    return state.runTime >= Math.max(settings.minRun, Number(settings.maxRun) || 1800);
  }

  function basicAutomationReserve(state) {
    const targets = [];
    for (const id of ['editor', 'teacher', 'workshop', 'scriptorium']) {
      if ((state.producers[id] || 0) > 0) continue;
      const def = producerDef(id);
      if (def) targets.push(producerCost(def, 0, state));
      break;
    }
    for (const id of ['editorial', 'teaching', 'workshopCoord', 'reference', 'shared', 'translationPrep']) {
      if (state.pageUpgrades[id]) continue;
      const def = upgradeDef(id);
      if (def) targets.push(bn(def.cost));
      break;
    }
    if (!targets.length) return TRANSLATION_THRESHOLD;
    return targets.reduce((best, cost) => cost.lt(best) ? cost : best);
  }

  function basicAutomationCanSpend(state, cost, reserve) {
    if (!canAfford(state.pages, cost)) return false;
    // Below the next progression target, Basic Automation may establish only its
    // small starter chain. Once the target is affordable, that balance is sacred.
    return state.pages.lt(reserve) || !state.pages.sub(cost).lt(reserve);
  }

  function buyBasicMethod(state, id, reserve) {
    const def = upgradeDef(id);
    if (!def || state.pageUpgrades[id]) return false;
    const cost = bn(def.cost);
    if (!basicAutomationCanSpend(state, cost, reserve)) return false;
    return buyPageUpgrade(state, id);
  }

  function buyBasicProducer(state, id, reserve, allowBelowReserve = false) {
    const def = producerDef(id);
    if (!def) return false;
    const cost = producerCost(def, state.producers[id], state);
    if (!canAfford(state.pages, cost)) return false;
    if (!allowBelowReserve && state.pages.sub(cost).lt(reserve)) return false;
    if (allowBelowReserve && !basicAutomationCanSpend(state, cost, reserve)) return false;
    return buyProducer(state, id, 1).bought > 0;
  }

  function runBasicAutomation(state) {
    const reserve = basicAutomationReserve(state);
    for (const id of ['desk', 'copying']) buyBasicMethod(state, id, reserve);

    // Establish the first useful milestone gradually instead of emptying the bank.
    // This is deliberately bounded: Basic Automation is a helper, not a spender.
    for (const id of ['copyist', 'scribe']) {
      for (let i = 0; i < 2 && state.producers[id] < 10; i++) {
        if (!buyBasicProducer(state, id, reserve, true)) break;
      }
    }

    // After the starter chain, purchase at most one of each early producer per
    // automation cycle and only from Pages above the next stronger progression target.
    for (const id of ['copyist', 'scribe']) buyBasicProducer(state, id, reserve, false);
  }

  function translationBoundaryHold(state) {
    const threshold = translationThreshold(state);
    if (state.peakPages.gte(threshold) || state.pages.gte(threshold)) return false;
    const production = pageProduction(state);
    if (production.isZero) return false;
    return threshold.sub(state.pages).lte(production.mul(60));
  }

  function runBaseAutomation(state) {
    runPurchaseQueue(state);
    const controls = state.automation.controls || { baseEnabled: true, projectsEnabled: true, translationEnabled: true };
    const reserve = purchaseQueueReserve(state);
    const queueBlocked = !!reserve && state.pages.lt(reserve);
    if (!queueBlocked && controls.baseEnabled !== false && state.automation.full) {
      if (!translationBoundaryHold(state)) {
        for (const up of PAGE_UPGRADES.filter(x => !x.utility)) buyPageUpgrade(state, up.id);
        for (const def of [...PRODUCERS].reverse()) buyProducer(state, def.id, 'max');
      }
    } else if (!queueBlocked && controls.baseEnabled !== false && state.automation.basic) {
      runBasicAutomation(state);
    }
    if (!queueBlocked && controls.projectsEnabled !== false && state.automation.projects) {
      if (state.netOneTime?.parallelProjects) {
        for (const p of PROJECTS) completeProject(state, p.id);
      } else {
        for (const p of PROJECTS) if (completeProject(state, p.id)) break;
      }
    }
  }

  function runAutomation(state) {
    runBaseAutomation(state);
    if (shouldAutoTranslate(state)) return completeTranslation(state, true);
    return null;
  }


  function sanitizePurchaseQueue(raw) {
    const orders = Array.isArray(raw?.orders) ? raw.orders : [];
    return { paused: !!raw?.paused, orders: orders.filter(o => o && ((o.type === 'producer' && producerDef(o.id) && Number.isSafeInteger(o.target) && o.target > 0 && o.target <= 100000) || (o.type === 'method' && PAGE_UPGRADES.some(d => d.id === o.id)))).slice(0, 6).map(o => o.type === 'producer' ? { type: o.type, id: o.id, target: o.target } : { type: o.type, id: o.id }) };
  }
  function queueUnlocked(state) { return !!state.pageUpgrades.desk || state.translations > 0 || state.networks > 0 || state.legacies > 0; }
  function enqueuePurchase(state, order) {
    if (!queueUnlocked(state) || state.purchaseQueue.orders.length >= 6) return false;
    const valid = sanitizePurchaseQueue({orders:[order]}).orders[0];
    if (!valid) return false;
    state.purchaseQueue.orders.push(valid); return true;
  }
  function editPurchaseQueue(state, index, action) {
    const q=state.purchaseQueue;
    if (action==='pause') { q.paused=!q.paused; return true; }
    if (!Number.isInteger(index) || index<0 || index>=q.orders.length) return false;
    if (action==='remove') q.orders.splice(index,1);
    else if (action==='up' && index>0) [q.orders[index-1],q.orders[index]]=[q.orders[index],q.orders[index-1]];
    else if (action==='down' && index<q.orders.length-1) [q.orders[index+1],q.orders[index]]=[q.orders[index],q.orders[index+1]];
    else return false;
    return true;
  }
  function setPurchaseOrderTarget(state, index, target) {
    if (!Number.isInteger(index) || !Number.isSafeInteger(target) || target < 1 || target > 100000 || state.purchaseQueue.orders[index]?.type !== 'producer') return false;
    state.purchaseQueue.orders[index].target = target; return true;
  }
  function runPurchaseQueue(state) {
    const q=state.purchaseQueue;
    if (!q || q.paused || !queueUnlocked(state)) return;
    while(q.orders.length) {
      const o=q.orders[0];
      if(o.type==='method') { if(!state.pageUpgrades[o.id]) buyPageUpgrade(state,o.id); if(!state.pageUpgrades[o.id]) break; }
      else { buyProducer(state,o.id,Math.max(0,o.target-state.producers[o.id])); if(state.producers[o.id]<o.target) break; }
      q.orders.shift();
    }
  }
  function purchaseQueueReserve(state) {
    const q = state.purchaseQueue;
    if (!q || q.paused || !queueUnlocked(state) || !q.orders.length) return null;
    const o = q.orders[0];
    if (o.type === 'method') {
      if (state.pageUpgrades[o.id]) return null;
      const def = upgradeDef(o.id);
      return def ? bn(def.cost) : null;
    }
    if (state.producers[o.id] >= o.target) return null;
    const def = producerDef(o.id);
    return def ? producerCost(def, state.producers[o.id], state) : null;
  }
  function purchaseQueueStatus(state) {
    if(!queueUnlocked(state)) return 'Purchase Organized Desk to plan six orders.';
    if(state.purchaseQueue.paused) return 'Paused — no planned purchases will run.';
    const o=state.purchaseQueue.orders[0];
    if(!o) return 'Add up to six orders. They run in sequence every ten seconds, including offline.';
    const d=o.type==='producer' ? producerDef(o.id) : PAGE_UPGRADES.find(x=>x.id===o.id);
    const cost=o.type==='producer' ? producerCost(d,state.producers[o.id],state) : bn(d.cost);
    return state.pages.gte(cost) ? 'Ready — purchasing on the next ten-second cycle.' : `Waiting for ${cost.format(2)} Pages for ${d.name}.`;
  }

  function setAutoSettings(state, patch) {
    const next = { ...state.automation.autoSettings, ...(patch || {}) };
    next.enabled = !!next.enabled;
    next.minRun = Math.max(1, Math.min(7200, Number(next.minRun) || 90));
    next.resetMultiple = Math.max(1, Math.min(10, Number(next.resetMultiple) || 1.35));
    next.maxRun = Math.max(next.minRun, Math.min(21600, Number(next.maxRun) || 1800));
    state.automation.autoSettings = next;
    return next;
  }

  function setAutomationControls(state, patch) {
    const current = state.automation.controls || { baseEnabled: true, projectsEnabled: true, translationEnabled: true };
    state.automation.controls = {
      baseEnabled: patch?.baseEnabled === undefined ? current.baseEnabled !== false : !!patch.baseEnabled,
      projectsEnabled: patch?.projectsEnabled === undefined ? current.projectsEnabled !== false : !!patch.projectsEnabled,
      translationEnabled: patch?.translationEnabled === undefined ? current.translationEnabled !== false : !!patch.translationEnabled
    };
    return { ...state.automation.controls };
  }

  function setSystemSettings(state, patch) {
    const current = state.system || createState().system;
    const next = { ...current, ...(patch || {}) };
    next.offlineEnabled = !!next.offlineEnabled;
    next.offlineCapSeconds = Math.max(3600, Math.min(30 * 86400, Number(next.offlineCapSeconds) || 14 * 86400));
    next.keyboardShortcuts = next.keyboardShortcuts !== false;
    next.confirmEarlyResets = next.confirmEarlyResets !== false;
    state.system = next;
    return { ...next };
  }

  function savePreset(state, slot) {
    if (!state.tiOneTime.presets) return false;
    const idx = Number(slot) - 1;
    if (idx < 0 || idx >= state.presets.length) return false;
    state.presets[idx] = {
      slot: idx + 1,
      name: state.presets[idx].name || `Preset ${idx + 1}`,
      saved: true,
      specialization: state.queuedSpecialization || state.specialization,
      auto: { ...state.automation.autoSettings }
    };
    return true;
  }

  function loadPreset(state, slot) {
    if (!state.tiOneTime.presets) return false;
    const idx = Number(slot) - 1;
    const preset = state.presets[idx];
    if (!preset?.saved) return false;
    if (preset.specialization && specializationUnlocked(state)) setSpecialization(state, preset.specialization, { forNextRun: !!state.specialization });
    setAutoSettings(state, preset.auto);
    return true;
  }

  function advanceEconomy(state, seconds, maxStep = 10) {
    if (!(seconds > 0)) return;
    const dt = Math.max(0.25, Math.min(300, Number(maxStep) || 10));
    let remaining = seconds;
    while (remaining > 1e-9) {
      // A shared wall-clock cadence prevents refresh rate from buying faster than offline play.
      const cycle = Math.floor((state.timePlayed + 1e-7) / 10);
      const toBoundary = (cycle + 1) * 10 - state.timePlayed;
      const step = Math.min(dt, remaining, Math.max(1e-6, toBoundary));
      if (state.economyCycle !== cycle) { runBaseAutomation(state); state.economyCycle = cycle; }
      const production = pageProduction(state);
      state.pages = state.pages.add(production.mul(step));
      state.peakPages = state.peakPages.max(state.pages);
      state.timePlayed += step;
      state.runTime += step;
      state.networkRunTime += step;
      state.legacyRunTime += step;
      state.records.highestPps = state.records.highestPps.max(production);
      if (state.records.firstThresholdAt === null && state.peakPages.gte(translationThreshold(state))) state.records.firstThresholdAt = state.timePlayed;
      if (Math.abs(state.timePlayed / 10 - Math.round(state.timePlayed / 10)) < 1e-7 && shouldAutoTranslate(state)) completeTranslation(state, true);
      updatePhase3Completion(state);
      updatePhase4Completion(state);
      updatePhase5Completion(state);
      updateLibraryUnlocks(state);
      remaining -= step;
    }
  }

  function tick(state, seconds) {
    advanceEconomy(state, seconds, 10);
  }

  function simulateOffline(state, seconds, options = {}) {
    const requestedSeconds = Math.max(0, Number(seconds) || 0);
    const configuredCap = state.system?.offlineCapSeconds || 14 * 86400;
    const capSeconds = Math.max(0, Number(options.capSeconds ?? configuredCap) || configuredCap);
    const simulatedSeconds = Math.min(requestedSeconds, capSeconds);
    const before = {
      pages: state.pages.clone(), lifetimeTi: state.lifetimeTi.clone(), lifetimeNc: state.lifetimeNc.clone(),
      lifetimeFe: state.lifetimeFe.clone(), lifetimeLegacy: state.lifetimeLegacy.clone(), translations: state.translations,
      networks: state.networks, fields: state.field.index + state.field.matureClears, legacies: state.legacies,
      pps: pageProduction(state), orders: state.purchaseQueue.orders.length, buildings: {...state.settlement?.buildings}
    };
    if (simulatedSeconds > 0) {
      // Offline progression intentionally uses the same 10-second economic cadence as live play.
      // The offline cap bounds work instead of silently changing automation/reset timing.
      const maxStep = Math.max(1, Math.min(10, Number(options.maxStep) || 10));
      advanceEconomy(state, simulatedSeconds, maxStep);
      state.records.offlineSeconds = Math.max(0, Number(state.records.offlineSeconds) || 0) + simulatedSeconds;
      state.records.offlineSessions = Math.max(0, Math.floor(Number(state.records.offlineSessions) || 0)) + 1;
      state.records.largestOfflineGap = Math.max(Math.max(0, Number(state.records.largestOfflineGap) || 0), requestedSeconds);
    }
    return {
      requestedSeconds,
      simulatedSeconds,
      cappedSeconds: Math.max(0, requestedSeconds - simulatedSeconds),
      ordersCompleted: Math.max(0, before.orders - state.purchaseQueue.orders.length),
      milestones: PRODUCERS.filter(p => (state.settlement?.buildings?.[p.id] || 0) >= 25 && (before.buildings[p.id] || 0) < 25).map(p => p.name),
      pagesBefore: before.pages,
      pagesAfter: state.pages.clone(),
      lifetimeTiGained: state.lifetimeTi.sub(before.lifetimeTi),
      lifetimeNcGained: state.lifetimeNc.sub(before.lifetimeNc),
      lifetimeFeGained: state.lifetimeFe.sub(before.lifetimeFe),
      lifetimeLegacyGained: state.lifetimeLegacy.sub(before.lifetimeLegacy),
      translations: state.translations - before.translations,
      networks: state.networks - before.networks,
      fields: (state.field.index + state.field.matureClears) - before.fields,
      legacies: state.legacies - before.legacies,
      ppsBefore: before.pps,
      ppsAfter: pageProduction(state)
    };
  }

  function recentRatePerSecond(runs, gainKey = 'gain', count = 5) {
    const selected = (runs || []).filter(r => r && r.duration > 0).slice(0, count);
    if (!selected.length) return 0;
    let gain = 0, duration = 0;
    for (const run of selected) {
      const n = bn(run[gainKey] || 0).toNumber();
      if (Number.isFinite(n)) gain += n;
      duration += Math.max(0, Number(run.duration) || 0);
    }
    return duration > 0 ? gain / duration : 0;
  }

  function estimateProgressEtas(state) {
    const pps = pageProduction(state).toNumber();
    const threshold = translationThreshold(state);
    let translation = 0;
    if (state.peakPages.lt(threshold)) {
      const need = threshold.sub(state.pages).toNumber();
      translation = Number.isFinite(need) && Number.isFinite(pps) && pps > 0 ? Math.max(0, need / pps) : null;
    }
    const nThreshold = effectiveNetworkThreshold(state).toNumber();
    const nRemaining = Math.max(0, nThreshold - state.tiThisNetwork.toNumber());
    const tiRate = recentRatePerSecond(state.records.recentTranslations);
    const network = nRemaining <= 0 ? 0 : (tiRate > 0 ? nRemaining / tiRate : null);
    const field = currentField(state) || nextField(state);
    const fThreshold = field ? fieldThreshold(state, field).toNumber() : 0;
    const fRemaining = field ? Math.max(0, fThreshold - state.field.progressNc.toNumber()) : 0;
    const ncRate = recentRatePerSecond(state.records.recentNetworks);
    const fieldEta = !field ? null : (fRemaining <= 0 ? 0 : (ncRate > 0 ? fRemaining / ncRate : null));
    const feRemaining = Math.max(0, LEGACY_UNLOCK_FE.toNumber() - state.feThisLegacy.toNumber());
    const feRate = recentRatePerSecond(state.records.recentFields);
    const legacy = feRemaining <= 0 ? 0 : (feRate > 0 ? feRemaining / feRate : null);
    return { translation, network, field: fieldEta, legacy, tiRate, ncRate, feRate };
  }

  function updatePhase2Completion(state) {
    const complete = !!state.tiOneTime.translationAutomation && specializationUnlocked(state) && state.lifetimeTi.gte(PHASE2_MASTERY_LIFETIME_TI);
    if (complete && !state.phase2Complete) {
      state.phase2Complete = true;
      if (state.records.phase2MasteredAt === null) state.records.phase2MasteredAt = state.timePlayed;
    }
    return complete;
  }

  function updatePhase3Completion(state) {
    const complete = fieldUnlocked(state) || state.field?.active || state.field?.index > 0;
    if (complete && !state.phase3Complete) {
      state.phase3Complete = true;
      if (state.records.fieldUnlockedAt === null) state.records.fieldUnlockedAt = state.timePlayed;
    }
    return complete;
  }

  function updatePhase4Completion(state) {
    const complete = legacyReady(state) || state.legacies > 0;
    if (complete && !state.phase4Complete) {
      state.phase4Complete = true;
      if (state.records.legacyReadyAt === null) state.records.legacyReadyAt = state.timePlayed;
    }
    return complete;
  }

  function updatePhase5Completion(state) {
    const final = finalSequenceAvailable(state);
    if (final && state.records.finalPhaseAt === null) state.records.finalPhaseAt = state.timePlayed;
    if (state.campaign.complete) state.phase5Complete = true;
    return state.phase5Complete;
  }

  function nextMilestone(owned) {
    for (const n of [10, 25, 50, 100, 250, 500]) if (owned < n) return n;
    return null;
  }

  function milestoneDescription(owned) {
    const next = nextMilestone(owned);
    if (next === null) return 'Mastered';
    const effects = { 10: '×2 self', 25: '×2 self', 50: '×3 self', 100: '+0.05 synergy exponent', 250: '×4 self', 500: 'Mastered' };
    return `${next}: ${effects[next]}`;
  }

  function getDebugSnapshot(state) {
    return {
      version: state.version,
      timePlayed: state.timePlayed,
      runTime: state.runTime,
      pages: state.pages.format(6),
      peakPages: state.peakPages.format(6),
      pps: pageProduction(state).format(6),
      ti: state.ti.format(6),
      lifetimeTi: state.lifetimeTi.format(6),
      translations: state.translations,
      translationGain: translationGain(state).format(6),
      translationEfficiency: translationEfficiency(state),
      tiUpgrades: { ...state.tiUpgrades },
      tiOneTime: { ...state.tiOneTime },
      specialization: state.specialization,
      queuedSpecialization: state.queuedSpecialization,
      automation: JSON.parse(JSON.stringify(state.automation)),
      system: JSON.parse(JSON.stringify(state.system || {})),
      offline: { seconds: state.records.offlineSeconds || 0, sessions: state.records.offlineSessions || 0, largestGap: state.records.largestOfflineGap || 0 },
      etas: estimateProgressEtas(state),
      phase2Complete: state.phase2Complete,
      phase3Complete: state.phase3Complete,
      nc: state.nc.format(6),
      lifetimeNc: state.lifetimeNc.format(6),
      tiThisNetwork: state.tiThisNetwork.format(6),
      ncThisField: state.ncThisField.format(6),
      networks: state.networks,
      networkRunTime: state.networkRunTime,
      networkGain: networkGain(state).format(6),
      allocation: { ...state.allocation },
      allocationEffects: allocationEffects(state),
      netUpgrades: { ...state.netUpgrades },
      netOneTime: { ...state.netOneTime },
      fe: state.fe.format(6),
      lifetimeFe: state.lifetimeFe.format(6),
      feThisLegacy: state.feThisLegacy.format(6),
      field: {
        active: state.field.active, index: state.field.index, current: currentField(state)?.id || null, next: nextField(state)?.id || null,
        progressNc: state.field.progressNc.format(6), stats: JSON.parse(JSON.stringify(state.field.stats))
      },
      fieldRewards: { ...state.fieldRewards },
      fieldReward: fieldReward(state).format(6),
      legacy: state.legacy.format(6),
      lifetimeLegacy: state.lifetimeLegacy.format(6),
      legacies: state.legacies,
      legacyRunTime: state.legacyRunTime,
      legacyGain: legacyGain(state).format(6),
      legacyMilestones: legacyMilestones(state),
      tradition: state.tradition,
      queuedTradition: state.queuedTradition,
      legacyReady: legacyReady(state),
      finalSequenceAvailable: finalSequenceAvailable(state),
      library: { ...(state.library || {}) },
      campaign: { ...state.campaign },
      phase4Complete: state.phase4Complete,
      phase5Complete: state.phase5Complete,
      producers: { ...state.producers },
      upgrades: { ...state.pageUpgrades },
      projects: { ...state.projects }
    };
  }

  return {
    VERSION, setSettlementDecoration, setPurchaseOrderTarget,
    canAfford, queueUnlocked, enqueuePurchase, editPurchaseQueue, purchaseQueueStatus, runPurchaseQueue,
    PRODUCERS,
    PAGE_UPGRADES,
    PROJECTS,
    TI_REPEATABLES,
    TI_ONE_TIMES,
    SPECIALIZATIONS,
    TRANSLATION_THRESHOLD,
    TRANSLATION_EXPONENT,
    SPECIALIZATION_UNLOCK_LIFETIME_TI,
    PHASE2_MASTERY_LIFETIME_TI,
    NETWORK_BASE_THRESHOLD,
    FIELD_UNLOCK_LIFETIME_NC,
    LEGACY_UNLOCK_FE,
    LEGACY_EXPONENT,
    LEGACY_SCALE,
    LEGACY_READINESS_TARGET_SECONDS,
    CAMPAIGN_LEGACY_TARGET,
    FIELD_REWARD_SCALE,
    FIELDS,
    MATURE_FIELD,
    MATURE_FIELD_PATTERNS,
    TRADITIONS,
    LEGACY_MILESTONES,
    SCRIPTURE_COLLECTIONS,
    NETWORK_UPGRADES,
    DISTRIBUTION_CHANNELS,
    BigNum,
    bn,
    createState,
    reviveState,
    serializeState,
    validateStatePayload,
    sanitizeState,
    producerCost,
    rawProducerCost,
    milestoneMultiplier,
    workflowMultiplier,
    trainingFactor,
    scholarMultiplier,
    translationReadinessTarget,
    specializationTiMultiplier,
    synergyExponent,
    pageProduction,
    translationThreshold,
    networkInfrastructureMultiplier,
    allocationLimits,
    isAllocationValid,
    setAllocation,
    allocationSynergies,
    allocationEffects,
    currentField,
    nextField,
    availableFields,
    fieldEligibility,
    fieldLockedReason,
    fieldClearCounts,
    fieldMasteryStatus,
    matureFieldForState,
    matureCycleStatus,
    legacyMilestones,
    legacyPowerMultiplier,
    traditionDef,
    setTradition,
    effectiveNetworkThreshold,
    fieldThreshold,
    effectivePreparationLevel,
    recommendedFieldAllocation,
    fieldObjectiveStatus,
    fieldReward,
    autoTranslationAllowed,
    canEnterField,
    enterField,
    completeField,
    legacyReady,
    legacyReadiness,
    legacyGain,
    legacyEfficiency,
    completeLegacy,
    finalSequenceAvailable,
    completeCampaign,
    scriptureCollectionUnlocked,
    updateLibraryUnlocks,
    networkThreshold,
    networkGain,
    networkReadiness,
    networkEfficiency,
    networkUpgradeCost,
    buyNetworkUpgrade,
    saveNetworkPreset,
    loadNetworkPreset,
    translationGain,
    translationReadiness,
    translationEfficiency,
    buyProducer,
    maxAffordableProducerCount,
    buyPageUpgrade,
    projectThreshold,
    projectVisible,
    projectStatus,
    completeProject,
    preparationEffect,
    resetBase,
    completeTranslation,
    completeNetwork,
    fieldUnlocked,
    repeatableCost,
    buyTiRepeatable,
    oneTimeAvailable,
    buyTiOneTime,
    specializationUnlocked,
    setSpecialization,
    hasBuyMax,
    shouldAutoTranslate,
    runAutomation,
    setAutoSettings,
    setAutomationControls,
    setSystemSettings,
    savePreset,
    loadPreset,
    tick,
    advanceEconomy,
    simulateOffline,
    estimateProgressEtas,
    updatePhase2Completion,
    updatePhase3Completion,
    updatePhase4Completion,
    updatePhase5Completion,
    nextMilestone,
    milestoneDescription,
    getDebugSnapshot
  };
});
