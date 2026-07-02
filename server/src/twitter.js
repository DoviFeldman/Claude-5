// Fetches your Twitter/X home timeline with plain HTTPS using your session
// cookies — no browser, so it runs comfortably on a tiny VPS.
//
// You need two cookies from a logged-in browser session: auth_token and ct0.
// The bearer token below is the public one every twitter.com visitor uses;
// your cookies are what authenticate the request as you.
import { config } from './config.js';

const PUBLIC_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// Twitter's GraphQL endpoints demand a "features" map. Unknown/extra flags are
// tolerated better than missing ones, so this is a broad superset. If the API
// complains about a missing feature, add it here with `false`.
const FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: false,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: false,
  responsive_web_enhance_cards_enabled: false,
};

function headers() {
  return {
    authorization: `Bearer ${PUBLIC_BEARER}`,
    cookie: `auth_token=${config.twAuthToken}; ct0=${config.twCt0}`,
    'x-csrf-token': config.twCt0,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    'content-type': 'application/json',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  };
}

// Twitter nests tweets differently depending on the timeline module type, and
// moves things around between deploys. Rather than chase exact paths, walk the
// whole response and pick up every object that looks like a tweet.
function collectTweets(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectTweets(item, out);
    return;
  }
  const legacy = node.legacy;
  if (legacy && typeof legacy.full_text === 'string' && node.core?.user_results?.result) {
    const user =
      node.core.user_results.result.legacy || node.core.user_results.result.core || {};
    const noteText = node.note_tweet?.note_tweet_results?.result?.text; // long tweets
    out.set(legacy.id_str || node.rest_id, {
      id: legacy.id_str || node.rest_id,
      author: user.screen_name || user.name || 'unknown',
      authorName: user.name || user.screen_name || 'unknown',
      text: noteText || legacy.full_text,
      likes: legacy.favorite_count || 0,
      retweets: legacy.retweet_count || 0,
      url: `https://x.com/${user.screen_name || 'i'}/status/${legacy.id_str || node.rest_id}`,
      ts: legacy.created_at || null,
      isRetweet: Boolean(legacy.retweeted_status_result),
    });
  }
  for (const value of Object.values(node)) collectTweets(value, out);
}

async function fetchTimelinePage(count, cursor) {
  const variables = {
    count,
    includePromotedContent: false,
    latestControlAvailable: true,
    withCommunity: true,
    ...(cursor ? { cursor } : {}),
  };
  const url =
    `https://x.com/i/api/graphql/${config.twHomeTimelineQueryId}/HomeTimeline` +
    `?variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&features=${encodeURIComponent(JSON.stringify(FEATURES))}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    throw new Error(
      `Twitter HomeTimeline request failed (HTTP ${res.status}). ` +
        `Usual causes: expired cookies (re-export auth_token/ct0) or a rotated ` +
        `query id (set TW_HOME_QUERY_ID, see README). Response: ${body}`
    );
  }
  return res.json();
}

function findBottomCursor(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findBottomCursor(item);
      if (found) return found;
    }
    return null;
  }
  if (node.cursorType === 'Bottom' && typeof node.value === 'string') return node.value;
  for (const value of Object.values(node)) {
    const found = findBottomCursor(value);
    if (found) return found;
  }
  return null;
}

export async function fetchHomeFeed(target = config.tweetCount) {
  if (!config.twAuthToken || !config.twCt0) {
    throw new Error('TW_AUTH_TOKEN and TW_CT0 are not set in server/.env (see README).');
  }
  const tweets = new Map();
  let cursor = null;
  for (let page = 0; page < 5 && tweets.size < target; page++) {
    const json = await fetchTimelinePage(Math.min(target, 100), cursor);
    const before = tweets.size;
    collectTweets(json, tweets);
    cursor = findBottomCursor(json);
    if (tweets.size === before || !cursor) break; // no progress → stop
  }
  const list = [...tweets.values()].filter((t) => t.text && !t.text.startsWith('RT @'));
  if (!list.length) {
    throw new Error(
      'Timeline request succeeded but no tweets were found in the response — ' +
        'the query id likely rotated. Set TW_HOME_QUERY_ID from browser devtools (see README).'
    );
  }
  return list.slice(0, target);
}
