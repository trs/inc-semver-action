const { context } = require("@actions/github/lib/utils");

const COMMIT_TYPE_PREFIX = /^(\w+)(?::|\((\w+)\):) (.+)$/i;
const COMMIT_MESSAGE_BREAKING_CHANGE = /^BREAKING CHANGE: (.+)/m;

const RELEASE_TYPES = [
  'patch',
  'minor',
  'major'
];

module.exports.determineReleaseType = function determineReleaseType(commits) {
  const hasBreaking = commits.find((commit) => COMMIT_MESSAGE_BREAKING_CHANGE.test(commit.message));
  if (hasBreaking) return RELEASE_TYPES[2];

  const type = commits
    .map((commit) => commit.message.match(COMMIT_TYPE_PREFIX))
    .filter((match) => match !== null)
    .map((match) => match[1].toLocaleLowerCase())
    .reduce((type, prefix) => {
      switch (prefix) {
        case 'feat': return type < 1 ? 1 : type;
        case 'fix': return type < 0 ? 0 : type;
        default: return type;
      }
    }, -1);

  if (type === -1) return null;
  return RELEASE_TYPES[type];
}

/**
 * Given an array of commits, format a change log
 */
module.exports.formatChangeLog = function formatChangeLog(commits) {
  const unknown = [];
  const changes = new Map();

  const add = (key, value) => {
    const values = changes.get(key) || [];
    values.push(value);
    changes.set(key, values);
  };

  // Organize changes
  for (const commit of commits) {
    const match = commit.message.match(COMMIT_TYPE_PREFIX);
    const breakingMatch = commit.message.match(COMMIT_MESSAGE_BREAKING_CHANGE);
    if (!match) {
      unknown.push(commit);
      continue;
    }

    const [, type, context, message] = match;
    const [, breaking] = breakingMatch || [];

    add(type.toLocaleUpperCase(), {
      ...commit,
      context,
      message,
      breaking
    });
  }

  // Build log
  let changelogLines = [];
  for (const [type, values] of changes.entries()) {
    changelogLines.push(`## ${type}`);
    for (const {context, message, breaking, url, abbreviatedOid} of values) {
      changelogLines.push(`- ${context ? `**${context}**: ` : ''}${message} ([${abbreviatedOid}](${url}))`);
      if (breaking) {
        changelogLines.push(`\t- **Breaking Change**: ${breaking}`);
      }
    }
    changelogLines.push('');
  }

  // Add un-parsable commits
  if (unknown.length > 0) {
    changelogLines.push(`## OTHER`);
    for (const commit of unknown) {
      changelogLines.push(`- ${commit.message}`);
    }
  }

  return changelogLines.join('\n');
}
