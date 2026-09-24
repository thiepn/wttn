'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { simulateCampaign } = require('./phase9-sim-lib.js');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'game-core.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const tmp = path.join(root, 'game-core.phase9-sensitivity.tmp.js');
const baseG = require(sourcePath);
const profile = { name:'sensitivity-active', decisionSeconds:60, maxDays:20 };
const baseline = simulateCampaign(baseG,profile).metrics.completeDays;
const params = [
  { name:'translationExponent', token:'const TRANSLATION_EXPONENT = 0.65;', make:f=>`const TRANSLATION_EXPONENT = ${(0.65*f).toFixed(6)};` },
  { name:'networkBaseThreshold', token:'const NETWORK_BASE_THRESHOLD = bn(1800);', make:f=>`const NETWORK_BASE_THRESHOLD = bn(${Math.round(1800*f)});` },
  { name:'fieldRewardScale', token:'const FIELD_REWARD_SCALE = 10;', make:f=>`const FIELD_REWARD_SCALE = ${(10*f).toFixed(6)};` },
  { name:'legacyUnlockFE', token:'const LEGACY_UNLOCK_FE = bn(70);', make:f=>`const LEGACY_UNLOCK_FE = bn(${Math.round(70*f)});` },
  { name:'legacyExponent', token:'const LEGACY_EXPONENT = 0.60;', make:f=>`const LEGACY_EXPONENT = ${(0.60*f).toFixed(6)};` },
  { name:'legacyScale', token:'const LEGACY_SCALE = 15.5;', make:f=>`const LEGACY_SCALE = ${(15.5*f).toFixed(6)};` },
  { name:'legacyReadinessHours', token:'const LEGACY_READINESS_TARGET_SECONDS = 30 * 3600;', make:f=>`const LEGACY_READINESS_TARGET_SECONDS = ${(30*f).toFixed(3)} * 3600;` },
];
const group = process.env.PHASE9_SENS_GROUP || 'all';
const selected = group === 'core' ? params.slice(0,3) : group === 'meta' ? params.slice(3) : params;
const rows=[];
try {
  for (const p of selected) for (const factor of [0.9,1.1]) {
    assert(source.includes(p.token), `Missing sensitivity token ${p.name}`);
    fs.writeFileSync(tmp, source.replace(p.token,p.make(factor)));
    delete require.cache[require.resolve(tmp)];
    const G = require(tmp);
    const days = simulateCampaign(G,{...profile,name:`${p.name}-${factor}`}).metrics.completeDays;
    const ratio = Math.max(days/baseline, baseline/days);
    rows.push({parameter:p.name,factor,days,ratio});
    console.log(`SENS ${p.name} ${factor}: ${Number.isFinite(days)?days.toFixed(3):'INF'}d · ${Number.isFinite(ratio)?ratio.toFixed(3):'INF'}x`);
    assert(Number.isFinite(days) && ratio <= 1.25, `${p.name} ${factor}: active sensitivity ${ratio.toFixed(3)}x`);
  }
} finally { try { fs.unlinkSync(tmp); } catch {} }
console.log(`Phase 9 sensitivity baseline: ${baseline.toFixed(3)}d`);
console.log('Phase 9 ±10% sensitivity sweep: PASS');
