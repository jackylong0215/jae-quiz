const symbols = {
  '×': ' times ', '÷': ' divided by ', '±': ' plus or minus ', '∓': ' minus or plus ',
  '≤': ' less than or equal to ', '≥': ' greater than or equal to ', '≠': ' not equal to ',
  '≈': ' approximately ', '√': ' square root of ', '∞': ' infinity ', 'π': ' pi ',
  '∈': ' belongs to ', '∩': ' intersection ', '∪': ' union ', '∅': ' empty set ',
  '∠': ' angle ', '°': ' degrees ', '△': ' triangle ', '⊥': ' perpendicular to ', '∥': ' parallel to ',
};
const commands = {
  frac: 'over', times: 'times', cdot: 'times', div: 'divided by', pm: 'plus or minus',
  leq: 'less than or equal to', le: 'less than or equal to', geq: 'greater than or equal to',
  ge: 'greater than or equal to', neq: 'not equal to', sqrt: 'square root of', pi: 'pi',
  infty: 'infinity', sum: 'sum', int: 'integral', cap: 'intersection', cup: 'union',
  left: '', right: '', text: '', mathrm: '', begin: '', end: '',
};
export function englishMathSpeech(text) {
  let result = String(text || '')
    .replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1 over $2')
    .replace(/\^\{([^{}]*)\}/g, ' to the power of $1 ')
    .replace(/\^([0-9a-zA-Z])/g, ' to the power of $1 ')
    .replace(/_\{([^{}]*)\}/g, ' subscript $1 ')
    .replace(/_([0-9a-zA-Z])/g, ' subscript $1 ')
    .replace(/\\([a-zA-Z]+)/g, (_, command) => ` ${commands[command] ?? command} `);
  for (const [symbol, word] of Object.entries(symbols)) result = result.replaceAll(symbol, word);
  return result.replace(/[$#*`{}]/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
