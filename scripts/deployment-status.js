#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

function getLatestTag(pattern) {
  const tags = exec(`git tag -l "${pattern}" --sort=-version:refname`);
  return tags ? tags.split('\n')[0] : null;
}

function getTagInfo(tag) {
  if (!tag) return null;
  
  const commit = exec(`git rev-list -n 1 ${tag}`);
  const date = exec(`git log -1 --format=%ai ${tag}`);
  const author = exec(`git log -1 --format=%an ${tag}`);
  const message = exec(`git tag -l --format='%(contents:subject)' ${tag}`);
  
  return {
    tag,
    commit: commit ? commit.substring(0, 7) : 'unknown',
    date: date || 'unknown',
    author: author || 'unknown',
    message: message || 'No message'
  };
}

function getConfig() {
  // Try to load from worker-config.json first
  try {
    const config = JSON.parse(readFileSync('worker-config.json', 'utf8'));
    return {
      serviceName: config.serviceName,
      workersDomain: config.workersDomain
    };
  } catch (error) {
    // Fall back to package.json name
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
      return {
        serviceName: pkg.name || 'your-service',
        workersDomain: 'your-domain.workers.dev'
      };
    } catch (error) {
      return {
        serviceName: 'your-service',
        workersDomain: 'your-domain.workers.dev'
      };
    }
  }
}

function main() {
  console.log('🚀 Deployment Status\n');

  // Get current branch
  const currentBranch = exec('git rev-parse --abbrev-ref HEAD');
  const currentCommit = exec('git rev-parse --short HEAD');
  
  console.log(`📍 Current branch: ${currentBranch}`);
  console.log(`📝 Current commit: ${currentCommit}\n`);

  // Get configuration
  const config = getConfig();
  const serviceName = config.serviceName;
  const workersDomain = config.workersDomain;

  // Check each environment
  const environments = [
    { name: 'Development', pattern: null, branch: 'main', url: `https://${serviceName}-dev.${workersDomain}` },
    { name: 'QA', pattern: 'qa-*', branch: null, url: `https://${serviceName}-qa.${workersDomain}` },
    { name: 'Production', pattern: 'prod-*', branch: null, url: `https://${serviceName}.${workersDomain}` }
  ];

  environments.forEach(env => {
    console.log(`## ${env.name}`);
    
    if (env.pattern) {
      const latestTag = getLatestTag(env.pattern);
      const tagInfo = getTagInfo(latestTag);
      
      if (tagInfo) {
        console.log(`  Latest tag: ${tagInfo.tag}`);
        console.log(`  Commit: ${tagInfo.commit}`);
        console.log(`  Date: ${tagInfo.date}`);
        console.log(`  Author: ${tagInfo.author}`);
        console.log(`  Message: ${tagInfo.message}`);
      } else {
        console.log(`  No tags found matching pattern: ${env.pattern}`);
      }
    } else {
      console.log(`  Deploys from: ${env.branch} branch (HEAD)`);
      const latestCommit = exec(`git log -1 --format="%h %s" ${env.branch}`);
      if (latestCommit) {
        console.log(`  Latest commit: ${latestCommit}`);
      }
    }
    
    console.log(`  URL: ${env.url}\n`);
  });

  // GitHub Actions URL
  const repoUrl = exec('git config --get remote.origin.url');
  if (repoUrl) {
    const match = repoUrl.match(/github\.com[:/](.+?)(\.git)?$/);
    if (match) {
      const repoPath = match[1];
      console.log(`🔗 GitHub Actions: https://github.com/${repoPath}/actions`);
    }
  }
}

main();