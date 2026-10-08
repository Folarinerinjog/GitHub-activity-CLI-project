#!/usr/bin/env node

const https = require('https');

const username = process.argv[2];

if (!username) {
  console.error('Error: Please provide a GitHub username.');
  console.error('Usage: github-activity <username>');
  process.exit(1);
}

const options = {
  hostname: 'api.github.com',
  path: `/users/${encodeURIComponent(username)}/events`,
  headers: {
    'User-Agent': 'GitHub-Activity-CLI-NodeJS',
    Accept: 'application/vnd.github+json'
  }
};

https.get(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode !== 200) {
      if (res.statusCode === 404) {
        console.error(`Error: User "${username}" was not found on GitHub.`);
      } else {
        console.error(`Error: Failed to fetch activity (HTTP ${res.statusCode || 'unknown'}).`);
      }
      process.exitCode = 1;
      return;
    }

    try {
      const events = JSON.parse(data);
      if (!Array.isArray(events)) {
        console.error('Error: GitHub returned an unexpected response instead of an event list.');
        process.exitCode = 1;
        return;
      }

      displayEvents(events, username);
    } catch (err) {
      console.error('Error parsing JSON response from GitHub:', err.message);
      process.exitCode = 1;
    }
  });
}).on('error', (err) => {
  console.error('Network error:', err.message);
  process.exitCode = 1;
});

function displayEvents(events, username) {
  if (events.length === 0) {
    console.log(`No recent public activity found for user "${username}".`);
    return;
  }

  console.log(`\nRecent activity for ${username}:\n`);

  events.slice(0, 15).forEach((event) => {
    const repoName = event.repo && event.repo.name ? event.repo.name : 'unknown repo';
    const payload = event.payload || {};
    let action;

    switch (event.type) {
      case 'PushEvent': {
        const commitCount = Number.isInteger(payload.size)
          ? payload.size
          : Array.isArray(payload.commits) && payload.commits.length > 0
            ? payload.commits.length
            : null;
        action = commitCount === null
          ? `Pushed to ${repoName}`
          : `Pushed ${commitCount} commit(s) to ${repoName}`;
        break;
      }
      case 'IssuesEvent':
        action = `${capitalize(payload.action || 'opened')} an issue in ${repoName}`;
        break;
      case 'WatchEvent':
        action = `Starred ${repoName}`;
        break;
      case 'CreateEvent':
        action = `Created ${payload.ref_type || 'repository'} in ${repoName}`;
        break;
      case 'PullRequestEvent':
        action = `${capitalize(payload.action || 'opened')} a pull request in ${repoName}`;
        break;
      case 'IssueCommentEvent':
        action = `Commented on an issue in ${repoName}`;
        break;
      default:
        action = `${event.type ? event.type.replace(/Event$/, '') : 'Activity'} in ${repoName}`;
        break;
    }

    console.log(`- ${action}`);
  });
  console.log();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
