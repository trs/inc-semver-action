const {context} = require('@actions/github');

const {octokit} = require('./state');

/**
 * Find the latest tag with the given prefix.
 */
module.exports.fetchLatestTag = async function fetchLatestTag(prefix) {
  const {repository} = await octokit.graphql(`
    query latestTag($repo: String!, $owner: String!, $prefix: String!) {
      repository(name:$repo, owner:$owner) {
        refs(refPrefix:"refs/tags/", last:1, query:$prefix) {
          nodes {
            name
            target {
              ... on Commit {
                oid,
                committedDate
              }
            }
          }
        }
      }
    }
  `, {
    ...context.repo,
    prefix
  });

  const latestNode = repository.refs.nodes[0];
  if (!latestNode) return null;

  return {
    tag: latestNode.name,
    version: latestNode.name.substring(prefix.length),
    oid: latestNode.target.oid,
    date: latestNode.target.committedDate,
  };
}

/**
 * Get all commits on the path from ref since the given date.
 */
module.exports.fetchCommits = async function fetchCommits(path, fromOid) {
  const { repository } = await octokit.graphql(`
    query commits($repo: String!, $owner: String!, $oid: GitObjectID!, $path: String!) {
      repository(name:$repo, owner:$owner) {
        object(oid:$oid) {
          ... on Commit {
            history(path:$path) {
              edges {
                node {
                  oid
                  message
                }
              }
            }
          }
        }
      }
    }
  `, {
    ...context.repo,
    oid: context.sha,
    path
  });

  const commits = [];
  for (const {node} of repository.object.history.edges) {
    if (node.oid === fromOid) break;

    commits.push(node);
  }

  return commits;
}
