import assert from 'node:assert/strict';
import { shortenAddress } from '../src/utils/shortenAddress.js';

assert.equal(shortenAddress(''), '');
assert.equal(shortenAddress('GABC123'), 'GABC123');
assert.equal(shortenAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'), 'GABCDE...7890');

console.log('shortenAddress tests passed');
