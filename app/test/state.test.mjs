// Unit tests for the radio playback state machine: node test/state.test.mjs
import assert from 'assert';
import { advance, segmentText, segmentAudioKey } from '../src/state.js';

const topics = [
  { title: 'A', autoExpand: true, summaryText: 'sumA', deepDiveText: 'diveA' },
  { title: 'B', autoExpand: false, summaryText: 'sumB', deepDiveText: 'diveB' },
  { title: 'C', autoExpand: false, summaryText: 'sumC', deepDiveText: 'diveC' },
];

const at = (topicIndex, segment) => ({ topicIndex, segment });

// Natural flow: summary of A auto-expands into its deep dive...
assert.deepEqual(advance(at(0, 'summary'), topics, 'FINISH'), at(0, 'deepDive'));
// ...deep dive of A ends -> summary of B...
assert.deepEqual(advance(at(0, 'deepDive'), topics, 'FINISH'), at(1, 'summary'));
// ...B is not autoExpand, so its summary ends -> summary of C.
assert.deepEqual(advance(at(1, 'summary'), topics, 'FINISH'), at(2, 'summary'));
// End of the last topic -> stopped.
assert.equal(advance(at(2, 'summary'), topics, 'FINISH'), null);

// NEXT always jumps to the next topic's summary, even mid deep dive.
assert.deepEqual(advance(at(0, 'deepDive'), topics, 'NEXT'), at(1, 'summary'));
assert.equal(advance(at(2, 'deepDive'), topics, 'NEXT'), null);

// BACK re-opens the PREVIOUS topic's deep dive (per spec).
assert.deepEqual(advance(at(2, 'summary'), topics, 'BACK'), at(1, 'deepDive'));
assert.equal(advance(at(0, 'summary'), topics, 'BACK'), null);

// EXPAND dives into the current topic.
assert.deepEqual(advance(at(1, 'summary'), topics, 'EXPAND'), at(1, 'deepDive'));

// SKIP behaves like the segment naturally ending.
assert.deepEqual(advance(at(0, 'summary'), topics, 'SKIP'), at(0, 'deepDive'));
assert.deepEqual(advance(at(1, 'summary'), topics, 'SKIP'), at(2, 'summary'));

// From stopped, any forward control restarts at the top; BACK jumps to the
// last topic's deep dive.
assert.deepEqual(advance(null, topics, 'SKIP'), at(0, 'summary'));
assert.deepEqual(advance(null, topics, 'NEXT'), at(0, 'summary'));
assert.deepEqual(advance(null, topics, 'BACK'), at(2, 'deepDive'));

// Empty briefing never crashes.
assert.equal(advance(null, [], 'NEXT'), null);
assert.equal(advance(at(0, 'summary'), null, 'NEXT'), null);

// Helpers.
assert.equal(segmentText(at(0, 'summary'), topics), 'sumA');
assert.equal(segmentText(at(1, 'deepDive'), topics), 'diveB');
assert.equal(segmentText(null, topics), '');
assert.equal(segmentAudioKey(at(2, 'deepDive')), 't2-deepDive');

console.log('state machine: all tests passed');
