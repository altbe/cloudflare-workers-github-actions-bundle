#!/usr/bin/env node

import { execSync } from 'child_process';
import readline from 'readline';
import { promisify } from 'util';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error executing: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

function execSilent(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
}

function getLatestVersion(env) {
  // Get all tags matching the environment pattern
  const tags = execSilent(`git tag -l "${env}-*" --sort=-version:refname`);
  if (!tags) return null;
  
  const tagList = tags.split('\n').filter(Boolean);
  if (tagList.length === 0) return null;
  
  // Extract version from the first (latest) tag
  const latestTag = tagList[0];
  const versionMatch = latestTag.match(/^[^-]+-(.+)$/);
  return versionMatch ? versionMatch[1] : null;
}

function showLatestVersions() {
  console.log('\n📊 Latest versions by environment:');
  
  const environments = ['dev', 'qa', 'prod'];
  environments.forEach(env => {
    const version = getLatestVersion(env);
    console.log(`  ${env.toUpperCase()}: ${version || 'No tags found'}`);
  });
  
  console.log('');
}

async function main() {
  console.log('🏷️  Create Deployment Tag\n');

  // Check for uncommitted changes
  const status = exec('git status --porcelain');
  if (status) {
    console.error('❌ You have uncommitted changes. Please commit or stash them first.');
    process.exit(1);
  }

  // Get current branch
  const currentBranch = exec('git rev-parse --abbrev-ref HEAD');
  console.log(`📍 Current branch: ${currentBranch}`);

  // Ask for environment
  const env = await question('Target environment (qa/prod): ');
  if (!['qa', 'prod'].includes(env.toLowerCase())) {
    console.error('❌ Invalid environment. Must be "qa" or "prod".');
    process.exit(1);
  }

  // Show latest versions before asking for version
  showLatestVersions();
  
  // Show the latest version for the selected environment specifically
  const currentVersion = getLatestVersion(env.toLowerCase());
  if (currentVersion) {
    console.log(`💡 Current ${env.toUpperCase()} version: ${currentVersion}\n`);
  }

  // Ask for version
  const version = await question('Version (e.g., 1.2.3): ');
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    console.error('❌ Invalid version format. Use semantic versioning (e.g., 1.2.3).');
    process.exit(1);
  }

  // Show recent commits
  console.log('\n📝 Recent commits:');
  console.log(exec('git log --oneline -10'));

  // Ask for commit SHA
  const commitSha = await question('\nCommit SHA to tag (press Enter for HEAD): ');
  const targetCommit = commitSha || 'HEAD';

  // Create tag name
  const tagName = `${env.toLowerCase()}-${version}`;
  
  // Confirm
  console.log(`\n📋 Summary:`);
  console.log(`  Environment: ${env}`);
  console.log(`  Version: ${version}`);
  console.log(`  Tag: ${tagName}`);
  console.log(`  Commit: ${targetCommit} (${exec(`git rev-parse --short ${targetCommit}`)})`);
  
  const confirm = await question('\nCreate this tag? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Tag creation cancelled.');
    process.exit(0);
  }

  // Create and push tag
  try {
    exec(`git tag -a "${tagName}" "${targetCommit}" -m "Deploy to ${env} - version ${version}"`);
    exec(`git push origin "${tagName}"`);
    
    console.log(`\n✅ Tag created and pushed: ${tagName}`);
    console.log('🚀 Deployment will start automatically via GitHub Actions.');
    
    // Show the tag info
    console.log('\n📊 Tag information:');
    console.log(exec(`git show ${tagName} --no-patch`));
  } catch (error) {
    console.error('❌ Failed to create or push tag:', error.message);
    process.exit(1);
  }

  rl.close();
}

main().catch(console.error);