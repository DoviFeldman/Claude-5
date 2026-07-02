// The "analog radio" playback model, as a pure reducer so it can be unit
// tested in plain Node. A position is { topicIndex, segment } where segment is
// 'summary' or 'deepDive'. null means stopped (before start / after the end).
//
// Controls:
//   NEXT    -> next topic's summary (skips whatever is left of this topic)
//   BACK    -> previous topic's DEEP DIVE (per spec: back re-opens the previous
//              subject in full)
//   EXPAND  -> this topic's deep dive
//   SKIP    -> "whatever would happen naturally when this segment ends"
//   FINISH  -> fired by the player when a segment's audio ends (same as SKIP)

export const START = { topicIndex: 0, segment: 'summary' };

export function advance(position, topics, action) {
  if (!topics || topics.length === 0) return null;
  if (!position) {
    // Stopped: any control starts the radio from the top.
    return action === 'BACK'
      ? { topicIndex: topics.length - 1, segment: 'deepDive' }
      : { ...START };
  }
  const { topicIndex, segment } = position;
  const nextTopic =
    topicIndex + 1 < topics.length ? { topicIndex: topicIndex + 1, segment: 'summary' } : null;

  switch (action) {
    case 'NEXT':
      return nextTopic;
    case 'BACK':
      return topicIndex > 0 ? { topicIndex: topicIndex - 1, segment: 'deepDive' } : null;
    case 'EXPAND':
      return { topicIndex, segment: 'deepDive' };
    case 'SKIP':
    case 'FINISH':
      if (segment === 'summary' && topics[topicIndex].autoExpand) {
        return { topicIndex, segment: 'deepDive' };
      }
      return nextTopic;
    default:
      return position;
  }
}

export function segmentText(position, topics) {
  if (!position) return '';
  const t = topics[position.topicIndex];
  return position.segment === 'summary' ? t.summaryText : t.deepDiveText;
}

export function segmentAudioKey(position) {
  return `t${position.topicIndex}-${position.segment}`;
}
