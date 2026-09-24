const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../game-core.js');
const X = require('../midgame-depth.js');

const root = path.resolve(__dirname, '..');
const text = f => fs.readFileSync(path.join(root,f),'utf8');

assert.strictEqual(X.version, '1.9.0');

// Specializations must now shape reset cadence, not just raw production.
{
  const s = G.createState(); s.translations = 5; s.lifetimeTi = G.bn(500);
  assert.strictEqual(G.translationReadinessTarget({ ...s, specialization:'publisher' }), 510);
  s.lifetimeNc = G.bn(1);
  assert.strictEqual(G.translationReadinessTarget({ ...s, specialization:'publisher' }), 1020);

  const scholar = G.createState(); scholar.translations = 5; scholar.specialization='scholar'; scholar.runTime=40*60;
  assert(G.specializationTiMultiplier(scholar) > 1.05 && G.specializationTiMultiplier(scholar) < 1.10);
  const teacher = G.createState(); teacher.translations=5; teacher.specialization='teacher'; teacher.projects={manuscript:true,reference:true,teaching:true};
  assert(Math.abs(G.specializationTiMultiplier(teacher)-1.09) < 1e-9);
}

// Distribution pair synergies are bounded and inspectable.
{
  const s=G.createState(); s.networks=1; s.lifetimeNc=G.bn(1); s.networkRunTime=1200;
  G.setAllocation(s,{local:.25,regional:.25,international:.25,digital:.25});
  const syn=G.allocationSynergies(s);
  assert(syn.recoveryBridge > 1 && syn.recoveryBridge < 1.13);
  assert(syn.insightBridge > 1 && syn.insightBridge < 1.11);
  assert(syn.projectBridge > 1 && syn.projectBridge < 1.08);
  const e=G.allocationEffects(s);
  assert(e.synergies && e.international > 1 && e.digitalProjectDivisor < 1);
}

// Translation strategy tools expose different roles and opportunity cost.
{
  const s=G.createState(); s.translations=5; s.lifetimeTi=G.bn(500); s.ti=G.bn(60); s.specialization='publisher';
  const profiles=G.SPECIALIZATIONS.map(x=>X.specializationModel(s,x.id));
  assert.deepStrictEqual(profiles.map(x=>x.id),['scholar','publisher','teacher']);
  assert(new Set(profiles.map(x=>x.role)).size===3);
  const inv=X.translationInvestmentModel(s);
  assert(inv.repeatables.length===3);
  assert(inv.recommendation && inv.recommendation.title);
  const auto=X.autoProfiles(s);
  assert.deepStrictEqual(auto.map(x=>x.id),['active','balanced','idle']);
  assert(auto[0].settings.minRun < auto[1].settings.minRun && auto[1].settings.minRun < auto[2].settings.minRun);
  assert(auto[0].settings.resetMultiple < auto[2].settings.resetMultiple);
}

// Distribution templates are comparison tools, not hidden invalid allocations.
{
  const s=G.createState(); s.networks=2; s.lifetimeNc=G.bn(2); s.networkRunTime=1800;
  const models=X.allocationTemplateModels(s);
  assert.strictEqual(models.length,4);
  assert(models.every(x=>x.metrics.valid));
  const ids=models.map(x=>x.metrics.posture.id);
  assert(ids.includes('recovery') && ids.includes('balanced') && ids.includes('projects') && ids.includes('translation'));
  assert(models.every(x=>x.metrics.pageMultiplier>1 && x.metrics.international>1));
}

// Reset planners compare present pace with history without mutating state.
{
  const s=G.createState(); s.translations=3; s.specialization='publisher'; s.peakPages=G.bn('1e15'); s.runTime=600;
  s.records.recentTranslations=[{gain:G.bn(20),duration:900}];
  const before=JSON.stringify(s);
  const model=X.translationResetModel(s);
  assert(model.gain>=1 && ['wait','consider','reset'].includes(model.action));
  assert.strictEqual(JSON.stringify(s),before);
}

// Shipping integration.
{
  const html=text('index.html'), sw=text('sw.js'), app=text('app.js');
  for (const id of ['translationDepthPanel','translationStrategyBoard','autoProfileGrid','networkDepthPanel','allocationStrategyBoard','allocationTemplateGrid']) assert(html.includes(`id="${id}"`),`missing ${id}`);
  assert(html.includes('<script src="midgame-depth.js"></script>'));
  assert(require('fs').readFileSync(require('path').join(__dirname,'../dist/web/index.html'), 'utf8').includes(JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../dist/build-manifest.json'),'utf8')).assets['midgame-depth.js']), 'module must be included in the cached document');
  assert(app.includes('window.WTTNDepth'));
  assert.strictEqual(JSON.parse(text('package.json')).version,'2.10.1');
  assert(app.includes("const APP_VERSION = '2.10.1'"));
  assert(sw.includes("const BUILD='__BUILD_ID__'"));
}

console.log('Pristine Phase 9 Translation & Network depth: PASS · specialization cadence · TI opportunity-cost tools · distribution synergies · strategy profiles · allocation comparison');
