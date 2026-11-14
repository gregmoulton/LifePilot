// Generates docs/exercise-manifest.md from dist/ladder.js so the #121 manifest can never drift from the app.
const L=require('../dist/ladder.js'),fs=require('node:fs'),path=require('node:path');
const rows=L.EXERCISES.map(x=>{const st=L.artStatus(x.id);return `| \`${x.id}\` | ${x.category} | ${x.rung} | ${x.name}${x.variant?' ('+x.variant+')':''} | ${x.equipment.length?x.equipment.join(', '):'None'}${x.equipmentPending?' ⚠ '+x.equipmentPending:''} | ${st==='missing'?'—':'`dist/exercises/'+x.art+'`'} | ${{'final-approved':'Final (owner-approved)','temporary':'Temporary concept crop — needs final art','missing':'**Missing** — needs owner-approved art'}[st]}${x.provisional?' · rung provisional':''} |`});
const out=`# The Pure — exercise & art manifest (generated)

Generated from \`dist/ladder.js\` by \`tools/exercise-manifest.cjs\`; do not edit by hand. Ladder v${L.VERSION}. ${L.EXERCISES.length} exercises (18 rungs + 3 ELITE).

| ID | Category | Rung | Official name | Required equipment | App asset | Art status |
|---|---|---|---|---|---|---|
${rows.join('\n')}

**\`is_new\`:** an exercise shows NEW on Ready when the ladder reached it by graduation, an ELITE unlock or an owner rung change, and it has not yet appeared in a completed real (non-practice) workout. It clears itself after the first real workout with it. The ladder's starting rungs are never NEW.

**Equipment** is what the exercise requires. The app lists it and never shows it as confirmed ready. ⚠ marks entries that need owner confirmation. They are not guessed.

**Art:** final masters live on \`art/purist-locked-v1\` in \`the-pure/art/purist/final-approved/\`. The remaining images are produced and owner-approved separately (#121); Claude installs only delivered, inspected files.
`;
fs.writeFileSync(path.join(__dirname,'../docs/exercise-manifest.md'),out);console.log('rows',rows.length);
