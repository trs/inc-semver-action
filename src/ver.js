const COMMIT_TYPE_PREFIX = /^(\w+): /i;
const COMMIT_MESSAGE_BREAKING_CHANGE = /^BREAKING CHANGE: /m;

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
