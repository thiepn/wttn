(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WTTNArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function wrap(body, label = '', cls = '') {
    return `<svg class="wttn-art ${cls}" viewBox="0 0 96 96" aria-hidden="true" focusable="false" data-art-label="${esc(label)}"><g class="art-ink" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  }

  const producerPaths = {
    scribe: `<path d="M23 70h40M31 63l10-37 10 37M36 47h10M60 22l11 11M56 26l11 11M69 21l7 7-26 26-10 3 3-10z"/><path d="M23 76c12-3 24-3 36 0"/>`,
    copyist: `<path d="M25 25h40v46H25zM31 32h28M31 40h28M31 48h23M31 56h25"/><path d="M33 19h40v46M41 13h40v46"/>`,
    editor: `<path d="M24 21h47v54H24zM32 31h25M32 41h20M32 51h26M32 61h19"/><path d="M57 44l6 6 12-16M18 31h7M18 44h7M18 57h7"/>`,
    teacher: `<path d="M18 68h60M26 68V42h44v26M34 49h28M37 42V31c0-7 5-12 11-12s11 5 11 12v11"/><path d="M42 31h12M48 19v-7"/>`,
    workshop: `<path d="M17 67h62M24 67V39l12 7 10-9 11 8 15-11v33"/><path d="M27 30h14v12H27zM59 21h12v15H59z"/><circle cx="45" cy="57" r="7"/><path d="M45 46v4M45 64v4M34 57h4M52 57h4M37 49l3 3M50 62l3 3M53 49l-3 3M40 62l-3 3"/>`,
    scriptorium: `<path d="M18 72h60M24 72V34h48v38M31 72V46h34v26"/><path d="M31 34c0-10 8-18 17-18s17 8 17 18M39 46c0-6 4-11 9-11s9 5 9 11"/><path d="M35 58h7M54 58h7M36 64h6M54 64h6"/>`
  };

  const methodPaths = {
    desk: `<path d="M21 64h54M28 64V42h40v22M32 42V27h32v15M38 34h20"/><path d="M55 20l8 8-17 17-9 2 2-9z"/>`,
    copying: `<path d="M25 22h40v48H25zM32 31h26M32 39h26M32 47h20M32 55h24"/><path d="M36 16h35v43"/>`,
    editorial: `<path d="M23 22h46v52H23zM31 32h24M31 43h20M31 54h22"/><path d="M54 52l6 6 13-19"/>`,
    teaching: `<path d="M20 69h56M28 69V43h40v26M35 50h26"/><circle cx="48" cy="27" r="8"/><path d="M48 35v8"/>`,
    workshopCoord: `<path d="M18 67h60M24 67V35l13 8 11-10 12 9 12-8v33"/><path d="M35 54h26M35 60h26"/>`,
    reference: `<path d="M23 21h50v54H23zM31 31h20M31 41h30M31 51h24M31 61h28"/><circle cx="64" cy="32" r="6"/><path d="M68 36l7 7"/>`,
    shared: `<circle cx="31" cy="49" r="9"/><circle cx="65" cy="49" r="9"/><circle cx="48" cy="26" r="9"/><path d="M38 43l5-8M53 35l5 8M40 49h16M31 58v12M65 58v12M48 17V9"/>`,
    translationPrep: `<path d="M21 67h54M27 67V31h42v36M34 39h14M34 48h26M34 57h22"/><path d="M59 23l8 8M55 27l8 8M66 22l6 6-17 17-8 2 2-8z"/>`
  };

  const projectPaths = {
    manuscript: `<path d="M20 30c7-6 13-6 20 0v38c-7-6-13-6-20 0zM40 30c7-6 13-6 20 0v38c-7-6-13-6-20 0z"/><path d="M27 40h7M27 49h7M47 40h7M47 49h7M61 28h15M68 28v42"/>`,
    reference: `<path d="M22 22h42v52H22zM31 32h24M31 42h18M31 52h22"/><path d="M62 56l11 11M67 51l8 8"/><circle cx="62" cy="51" r="10"/>`,
    teaching: `<path d="M17 68h62M25 68V43h46v25M34 50h28"/><path d="M35 32c0-7 5-12 13-12s13 5 13 12v11M42 30h12"/><path d="M31 58h10M55 58h10"/>`
  };

  const specializationPaths = {
    scholar: `<path d="M18 60c10-8 20-8 30 0 10-8 20-8 30 0V27c-10-7-20-7-30 0-10-7-20-7-30 0zM48 27v33"/><circle cx="48" cy="17" r="5"/><path d="M48 12V6"/>`,
    publisher: `<path d="M21 69h54M28 69V39h40v30M34 39V24h28v15"/><path d="M35 51h26M35 58h26M40 24v-9h16v9"/>`,
    teacher: `<path d="M19 70h58M27 70V44h42v26M36 52h24"/><circle cx="48" cy="27" r="8"/><path d="M48 35v9M39 62h18"/>`
  };

  const channelPaths = {
    local: `<path d="M20 68h56M29 68V45l19-15 19 15v23M39 68V55h18v13"/><circle cx="48" cy="20" r="5"/>`,
    regional: `<circle cx="25" cy="61" r="8"/><circle cx="48" cy="34" r="8"/><circle cx="72" cy="61" r="8"/><path d="M31 55l11-15M54 40l12 15M33 61h31"/>`,
    international: `<circle cx="48" cy="48" r="29"/><path d="M19 48h58M48 19c10 9 15 19 15 29S58 68 48 77M48 19C38 28 33 38 33 48s5 20 15 29M27 32h42M27 64h42"/>`,
    digital: `<circle cx="48" cy="48" r="10"/><circle cx="22" cy="25" r="6"/><circle cx="74" cy="24" r="6"/><circle cx="76" cy="72" r="6"/><circle cx="20" cy="70" r="6"/><path d="M40 41L27 29M56 41l13-12M56 55l15 13M40 55L25 67"/>`
  };

  const fieldPaths = {
    urban: `<path d="M18 72h60M25 72V42h14v30M42 72V25h15v47M61 72V35h11v37"/><path d="M29 49h6M29 57h6M46 34h7M46 43h7M46 52h7M64 43h5M64 51h5"/>`,
    remote: `<path d="M14 71h68M22 65l15-28 12 16 10-10 15 22"/><path d="M31 61h34M49 53v18"/><circle cx="49" cy="53" r="4"/>`,
    oral: `<path d="M20 53c10-9 17-12 28-12s18 3 28 12M24 62c8-6 15-8 24-8s16 2 24 8"/><path d="M48 20v18M42 26h12"/><circle cx="48" cy="74" r="5"/>`,
    restricted: `<rect x="22" y="28" width="52" height="44" rx="4"/><path d="M34 28v-6c0-8 6-14 14-14s14 6 14 14v6M33 50h30M48 39v22"/>`,
    multilingual: `<path d="M17 30h26v24H30l-9 8 2-8h-6zM53 43h26v24h-6l2 8-9-8H53z"/><path d="M24 38h12M60 51h12M60 58h8"/>`,
    'urban-ii': `<path d="M14 72h68M21 72V44h12v28M36 72V25h14v47M54 72V35h10v37M68 72V30h8v42"/><path d="M18 55h60M42 25V15"/>`,
    'remote-ii': `<path d="M12 72h72M18 66l17-31 13 17 9-9 18 23"/><path d="M31 62h35M48 52v20M41 58h14"/><path d="M62 31l8-8"/>`,
    'multilingual-ii': `<path d="M14 27h28v24H28l-10 9 3-9h-7zM54 39h28v24h-7l3 9-11-9H54z"/><path d="M21 35h14M61 47h14M61 54h10M40 66c6 4 10 6 16 7"/>`,
    'frontier-iii': `<path d="M14 73h68M20 67l14-24 10 13 9-10 15 21"/><path d="M48 18v43M42 24h12"/><circle cx="48" cy="18" r="5"/><path d="M70 27l7 7-9 9"/>`,
    'mature-field': `<circle cx="48" cy="48" r="27"/><circle cx="48" cy="48" r="17"/><path d="M48 11v10M48 75v10M11 48h10M75 48h10M30 30l7 7M59 59l7 7M66 30l-7 7M37 59l-7 7"/><path d="M42 48h12"/>`
  };

  const traditionPaths = {
    translation: `<path d="M20 62c9-7 18-7 28 0 10-7 19-7 28 0V28c-9-6-18-6-28 0-10-6-19-6-28 0zM48 28v34"/><path d="M61 21l7 7-12 12"/>`,
    teaching: `<path d="M18 69h60M27 69V44h42v25M36 51h24"/><circle cx="48" cy="28" r="7"/><path d="M48 35v9M39 61h18"/>`,
    distribution: `<circle cx="48" cy="48" r="8"/><circle cx="20" cy="27" r="5"/><circle cx="77" cy="26" r="5"/><circle cx="76" cy="70" r="5"/><circle cx="20" cy="70" r="5"/><path d="M42 43L25 31M54 43l18-13M54 54l17 12M42 54L25 66"/>`,
    pioneer: `<path d="M15 70h66M22 64l15-28 13 18 10-12 15 22"/><path d="M49 16v42M43 22h12"/><circle cx="49" cy="16" r="4"/>`
  };

  const libraryPaths = {
    torah: `<path d="M26 23h44M26 73h44M30 23v50M66 23v50"/><path d="M36 34h24M36 43h24M36 52h18M36 61h21"/><circle cx="26" cy="23" r="4"/><circle cx="70" cy="23" r="4"/><circle cx="26" cy="73" r="4"/><circle cx="70" cy="73" r="4"/>`,
    history: `<path d="M18 70h60M25 70V31h46v39M31 31l17-12 17 12M35 43h26M35 53h26M35 63h26"/><path d="M48 19V11"/>`,
    wisdom: `<path d="M37 67h22M40 73h16"/><path d="M34 43c0-9 6-16 14-16s14 7 14 16c0 7-4 11-8 15H42c-4-4-8-8-8-15z"/><path d="M48 17V9M27 23l6 6M69 23l-6 6M22 43h8M66 43h8"/>`,
    prophets: `<path d="M25 67c13-3 25-3 38 0V28c-13-3-25-3-38 0z"/><path d="M43 22l5-12 5 12M34 40h20M34 50h20M34 60h15"/>`,
    gospels: `<path d="M21 61c9-7 18-7 27 0 9-7 18-7 27 0V27c-9-6-18-6-27 0-9-6-18-6-27 0zM48 27v34"/><path d="M48 14v8M35 18l5 5M61 18l-5 5"/>`,
    acts: `<circle cx="22" cy="68" r="5"/><circle cx="74" cy="25" r="5"/><path d="M27 65C37 59 38 49 45 44c7-6 14-3 18-9 3-4 4-7 6-9"/><path d="M38 49l7-5M56 39l7-4"/>`,
    epistles: `<path d="M20 29h56v42H20z"/><path d="M20 29l28 24 28-24M28 62h22"/><path d="M57 60l8 8"/>`,
    revelation: `<circle cx="48" cy="48" r="28"/><circle cx="48" cy="48" r="17"/><path d="M48 12v12M48 72v12M12 48h12M72 48h12M23 23l9 9M64 64l9 9M73 23l-9 9M32 64l-9 9"/><path d="M48 36l4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1z"/>`
  };

  function art(map, id, cls, label) { return map[id] ? wrap(map[id], label || id, cls) : ''; }
  function producer(id) { return art(producerPaths, id, 'art-producer', id); }
  function method(id) { return art(methodPaths, id, 'art-method', id); }
  function project(id) { return art(projectPaths, id, 'art-project', id); }
  function specialization(id) { return art(specializationPaths, id, 'art-specialization', id); }
  function channel(id) { return art(channelPaths, id, 'art-channel', id); }
  function field(id) { return art(fieldPaths, id, 'art-field', id); }
  function fieldSymbol(id) { const body = fieldPaths[id]; return body ? `<g class="atlas-art-glyph" transform="translate(-12 -12) scale(.25)"><g fill="none" stroke="currentColor" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></g>` : ''; }
  function tradition(id) { return art(traditionPaths, id, 'art-tradition', id); }
  function library(id) { return art(libraryPaths, id, 'art-library', id); }

  function seal(label, variant = 'default') {
    const safe = esc(String(label).slice(0, 3).toUpperCase());
    return `<span class="wttn-seal seal-${esc(variant)}" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="19"/><path d="M32 7v6M32 51v6M7 32h6M51 32h6"/><text x="32" y="37" text-anchor="middle">${safe}</text></svg></span>`;
  }

  return { producer, method, project, specialization, channel, field, fieldSymbol, tradition, library, seal };
});
