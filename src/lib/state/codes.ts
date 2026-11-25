// Codes as people type them, save codes ("tiger moon rain 42") and class codes ("fox pear 42"), in the
// server's form ("TIGER-MOON-RAIN-42"). Capitals, spaces, dashes and full stops don't matter, and a number
// typed straight after the last word ("rain42") is split from it. Nothing looser (no misspellings, no words
// run together): every loose match makes codes easier to guess. The server cleans codes the same way
// (cleanCode in deploy/site/worker.js; codes.test.ts holds the two together).
export const cleanCode = (c: string) => c.toUpperCase().replace(/([A-Z])([0-9])/g, '$1-$2').replace(/([0-9])([A-Z])/g, '$1-$2').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
